'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiff } from '@/hooks/useLiff';
import { QrCode, Camera, CheckCircle2, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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
  type: 'premium' | 'regular';
  stamps: number;  // スタンプ個数（pointsではない）
}

export default function QRScanPage() {
  const router = useRouter();
  const { profile, isLoading: liffLoading } = useLiff();
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    stampCount?: number;
    stampsAdded?: number;
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

      if (payload.type !== 'premium' && payload.type !== 'regular') {
        setError('サポートされていないQRコードタイプです');
        return;
      }

      // スタンプ付与APIを呼び出し
      const response = await fetch('/api/stamps/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: profile!.userId,
          type: payload.type,
          stamps: payload.stamps,  // stampsに統一
          qrCodeId: `${payload.type}_${new Date().toISOString().split('T')[0]}`,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setScanResult({
          success: true,
          message: data.message,
          stampCount: data.stampCount,
          stampsAdded: data.stampsAdded,
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
              <div className="mt-4">
                <Link
                  href="/"
                  className="block w-full bg-primary text-white text-center font-bold py-3 rounded-lg hover:bg-primary-dark transition-colors"
                >
                  診察券を確認する
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
                placeholder='{"type":"premium","stamps":10}'
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
                onClick={() => setManualInput('{"type":"premium","stamps":10}')}
                className="block w-full text-left text-xs text-blue-600 hover:underline"
              >
                優良患者様用 (10個)
              </button>
              <button
                onClick={() => setManualInput('{"type":"regular","stamps":5}')}
                className="block w-full text-left text-xs text-blue-600 hover:underline"
              >
                通常患者様用 (5個)
              </button>
            </div>
          </div>
        )}

        {/* 注意事項 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-800 font-medium mb-2">📌 ご注意</p>
          <ul className="text-xs text-yellow-700 space-y-1">
            <li>• 同じQRコードは1日1回のみスキャン可能です</li>
            <li>• QRコードは院内の受付または診察室に設置されています</li>
            <li>• スタンプが正しく付与されない場合はスタッフにお声がけください</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
