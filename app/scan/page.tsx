'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiff } from '@/hooks/useLiff';
import { QrCode, Camera, CheckCircle2, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { logStampScanStart, logStampScanApiRequest } from '@/lib/analytics';

/**
 * QRコードスキャンページ
 *
 * 仕様: Doc/24_QRコード表示_LIFFアプリ開発者へ.md
 *
 * 対応QRコードペイロード:
 * - 優良患者様用: {"type":"premium","stamps":10}
 * - 通常患者様用: {"type":"regular","stamps":5}
 */

interface QRPayload {
  type: 'premium' | 'regular' | 'purchase';
  stamps: number;  // スタンプ個数（pointsではない）
}

// 特典名を取得
const getRewardName = (rewardType: string): string => {
  switch (rewardType) {
    case 'toothbrush':
      return '歯ブラシ 1本';
    case 'poic':
      return 'POIC殺菌剤';
    case 'premium_menu':
      return '選べるメニュー';
    default:
      return '特典';
  }
};

// 有効期限の説明を取得
const getValidityDescription = (rewardType: string): string => {
  switch (rewardType) {
    case 'toothbrush':
      return '今日中（23:59まで）';
    case 'poic':
      return '5ヶ月間';
    case 'premium_menu':
      return '5ヶ月間';
    default:
      return '';
  }
};

export default function QRScanPage() {
  const router = useRouter();
  const { profile, isLoading: liffLoading } = useLiff();
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    stampCount?: number;
    stampsAdded?: number;
    milestones?: Array<{
      milestone: number;
      rewardType: string;
      exchangeId: string;
    }>;
  } | null>(null);
  const [error, setError] = useState('');

  // LIFFアプリのscanCodeV2を使用してQRコードをスキャン
  const handleScanQR = async () => {
    if (!profile?.userId) {
      setError('ユーザー情報が取得できません');
      return;
    }

    setIsScanning(true);
    setError('');
    setScanResult(null);

    // デバイス判定
    const deviceType = /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'iPhone' as const :
                       /Android/.test(navigator.userAgent) ? 'Android' as const : 'Unknown' as const;

    // 🆕 QRスキャン開始ログ
    await logStampScanStart({
      userId: profile?.userId,
      deviceType,
    });

    try {
      // LIFF SDK v2のscanCodeV2を使用
      if (typeof window !== 'undefined' && window.liff && window.liff.scanCodeV2) {
        const result = await window.liff.scanCodeV2();

        if (result && result.value) {
          await processQRCode(result.value);
        } else {
          setError('QRコードを読み取れませんでした');
        }
      } else {
        setError('カメラ機能が利用できません。LIFFブラウザでアクセスしてください。');
      }
    } catch (err) {
      console.error('QRスキャンエラー:', err);
      if (err instanceof Error) {
        if (err.message.includes('CANCEL')) {
          // ユーザーがキャンセルした場合
          setError('');
        } else {
          setError('QRコードの読み取りに失敗しました');
        }
      } else {
        setError('QRコードの読み取りに失敗しました');
      }
    } finally {
      setIsScanning(false);
    }
  };

  // QRコードのペイロードを処理してAPIを呼び出す
  const processQRCode = async (qrValue: string) => {
    try {
      // デバッグ: QRコード生値をコンソールに出力
      console.log('📱 [Scan Page] QRコード生値:', qrValue);

      // JSONペイロードをパース
      let payload: QRPayload;
      try {
        payload = JSON.parse(qrValue);
        console.log('📱 [Scan Page] パース後のペイロード:', payload);
      } catch {
        setError('無効なQRコードです。つくばホワイト歯科のQRコードをスキャンしてください。');
        return;
      }

      // ペイロードの検証
      if (!payload.type || !payload.stamps) {
        setError('無効なQRコードフォーマットです');
        return;
      }

      if (payload.type !== 'premium' && payload.type !== 'regular' && payload.type !== 'purchase') {
        setError('サポートされていないQRコードタイプです');
        return;
      }

      // スタンプ付与APIを呼び出し
      // 購買インセンティブは毎回ユニークなID、それ以外は日付ベース
      const qrCodeId = payload.type === 'purchase'
        ? `${payload.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        : `${payload.type}_${new Date().toISOString().split('T')[0]}`;

      const requestPayload = {
        userId: profile!.userId,
        type: payload.type,
        stamps: payload.stamps,  // stampsに統一
        qrCodeId,
      };

      // 🆕 APIリクエスト前にログ送信（QR生値とパース結果を記録）
      await logStampScanApiRequest({
        userId: profile?.userId,
        qrRawValue: qrValue,
        qrParsed: payload,
        requestPayload,
      });

      const response = await fetch('/api/stamps/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setScanResult({
          success: true,
          message: data.message,
          stampCount: data.stampCount,
          stampsAdded: data.stampsAdded,
          milestones: data.milestones,
        });
      } else {
        setError(data.message || 'スタンプの付与に失敗しました');
      }
    } catch (err) {
      console.error('QR処理エラー:', err);
      setError('通信エラーが発生しました');
    }
  };

  // 手動入力モード（テスト用）
  const [manualInput, setManualInput] = useState('');
  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      processQRCode(manualInput);
    }
  };

  if (liffLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 pb-24">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft size={24} />
          </Link>
          <h1 className="flex-1 text-xl font-bold text-gray-800">QRコードスキャン</h1>
          <QrCode size={28} className="text-primary" />
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        {/* 説明カード */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-start gap-3 mb-4">
            <Camera size={24} className="text-primary flex-shrink-0 mt-1" />
            <div>
              <h2 className="font-bold text-gray-800 mb-2">来院スタンプを取得</h2>
              <p className="text-sm text-gray-600">
                院内に設置されているQRコードをスキャンして、スタンプを獲得しましょう。
              </p>
            </div>
          </div>
        </div>

        {/* マイルストーン達成通知 */}
        {scanResult && scanResult.success && scanResult.milestones && scanResult.milestones.length > 0 && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl shadow-lg p-6 animate-bounce-once">
            <div className="text-center mb-4">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-xl font-bold text-orange-800 mb-1">マイルストーン達成！</p>
              <p className="text-sm text-orange-700">特典を獲得しました</p>
            </div>

            <div className="space-y-3">
              {scanResult.milestones.map((m, index) => (
                <div key={index} className="bg-white rounded-lg p-4 border border-yellow-200">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🎁</div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800 mb-1">
                        {m.milestone}個目：{getRewardName(m.rewardType)}
                      </p>
                      <p className="text-sm text-gray-600 mb-2">
                        {m.rewardType === 'toothbrush'
                          ? '✨ 当日限り（今日の23:59まで）'
                          : m.rewardType === 'poic'
                          ? '初回：殺菌剤ボトル＋詰め替え用'
                          : '選べるメニュー割引'}
                      </p>
                      <div className={`text-xs font-medium ${
                        m.rewardType === 'toothbrush'
                          ? 'text-red-600'
                          : 'text-blue-600'
                      }`}>
                        有効期限: {getValidityDescription(m.rewardType)}
                      </div>
                      {m.rewardType === 'toothbrush' && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                          <p className="text-xs text-red-700 font-medium">
                            ⚠️ 今日中に受付でお受け取りください！
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-center">
              <p className="text-sm text-orange-700 font-medium">
                受付でお声がけください
              </p>
            </div>
          </div>
        )}

        {/* スキャン結果 */}
        {scanResult && (
          <div className={`rounded-xl shadow-md p-6 border-2 ${
            scanResult.success
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start gap-3">
              {scanResult.success ? (
                <CheckCircle2 size={28} className="text-green-600 flex-shrink-0" />
              ) : (
                <XCircle size={28} className="text-red-600 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className={`font-bold mb-2 ${
                  scanResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {scanResult.message}
                </p>
                {scanResult.success && (
                  <div className="text-sm text-green-700 space-y-1">
                    <p>✨ +{scanResult.stampsAdded}個 獲得</p>
                    <p>📊 合計スタンプ数: {scanResult.stampCount}個</p>
                  </div>
                )}
              </div>
            </div>
            {scanResult.success && (
              <div className="mt-4 space-y-2">
                <Link
                  href="/rewards"
                  className="block w-full bg-orange-500 text-white text-center font-bold py-3 rounded-lg hover:bg-orange-600 transition-colors"
                >
                  特典を確認する
                </Link>
                <Link
                  href="/"
                  className="block w-full bg-primary text-white text-center font-bold py-3 rounded-lg hover:bg-primary-dark transition-colors"
                >
                  会員証を確認する
                </Link>
              </div>
            )}
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <XCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* スキャンボタン */}
        <button
          onClick={handleScanQR}
          disabled={isScanning || !profile?.userId}
          className="w-full bg-gradient-to-r from-primary to-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
        >
          {isScanning ? (
            <>
              <Loader2 size={24} className="animate-spin" />
              <span>スキャン中...</span>
            </>
          ) : (
            <>
              <Camera size={24} />
              <span>QRコードをスキャン</span>
            </>
          )}
        </button>

        {/* 手動入力（テスト用） */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <p className="text-xs text-gray-500 mb-2">開発者モード: 手動入力</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder='{"type":"premium","stamps":15}'
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={handleManualSubmit}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700"
              >
                送信
              </button>
            </div>
            <div className="mt-2 space-y-1">
              <button
                onClick={() => setManualInput('{"type":"premium","stamps":15}')}
                className="block w-full text-left text-xs text-blue-600 hover:underline"
              >
                優良患者様用 (15個)
              </button>
              <button
                onClick={() => setManualInput('{"type":"regular","stamps":10}')}
                className="block w-full text-left text-xs text-blue-600 hover:underline"
              >
                通常患者様用 (10個)
              </button>
              <button
                onClick={() => setManualInput('{"type":"purchase","stamps":5}')}
                className="block w-full text-left text-xs text-blue-600 hover:underline"
              >
                購買インセンティブ用 (5個)
              </button>
            </div>
          </div>
        )}

        {/* 注意事項 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-800 font-medium mb-2">📌 ご注意</p>
          <ul className="text-xs text-yellow-700 space-y-1">
            <li>• 来院用QRコード（優良・通常）は1日1回のみスキャン可能です</li>
            <li>• 購買インセンティブ用QRコードは何度でもスキャン可能です</li>
            <li>• スタンプが正しく付与されない場合はスタッフにお声がけください</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
