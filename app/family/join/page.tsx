'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiff } from '@/hooks/useLiff';
import { Users, QrCode, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function FamilyJoinPage() {
  const router = useRouter();
  const { profile, isLoading: liffLoading } = useLiff();
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleJoin = async () => {
    if (!profile?.userId) {
      setError('ユーザー情報を取得できませんでした');
      return;
    }

    if (!inviteCode.trim()) {
      setError('招待コードを入力してください');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/families/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.userId,
          inviteCode: inviteCode.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '家族への参加に失敗しました');
      }

      console.log('✅ 家族参加成功:', data);

      // 成功 → ホーム画面へ
      router.push('/');
    } catch (err) {
      console.error('家族参加エラー:', err);
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
      setIsLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInviteCode(text);
    } catch (err) {
      console.error('クリップボード読み取りエラー:', err);
    }
  };

  if (liffLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-kids-pink/10 to-white">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-kids-pink mx-auto mb-4" />
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-kids-pink/10 to-white px-4 py-8">
      <div className="max-w-md mx-auto">
        {/* 戻るボタン */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft size={20} />
          <span>戻る</span>
        </Link>

        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-kids-pink/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={40} className="text-kids-pink" />
          </div>
          <h1 className="text-2xl font-bold mb-2">家族に参加</h1>
          <p className="text-gray-600 text-sm">
            保護者から受け取った招待コードを<br />
            入力してください
          </p>
        </div>

        {/* 入力フォーム */}
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              招待コード
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="例: 6ae90eb7-7076..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-kids-pink focus:border-transparent outline-none"
                disabled={isLoading}
              />
              <button
                onClick={handlePaste}
                disabled={isLoading}
                className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                貼り付け
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              ※招待コードは保護者の方からLINEなどで送ってもらいましょう
            </p>
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* 参加ボタン */}
          <button
            onClick={handleJoin}
            disabled={!inviteCode.trim() || isLoading}
            className="w-full bg-kids-pink text-white font-semibold py-3 rounded-lg hover:bg-kids-pink/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                参加中...
              </>
            ) : (
              '家族に参加'
            )}
          </button>

          {/* 区切り線 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">または</span>
            </div>
          </div>

          {/* QRコードボタン（将来実装） */}
          <button
            disabled
            className="w-full flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-400 font-semibold py-3 rounded-lg cursor-not-allowed"
          >
            <QrCode size={20} />
            QRコードで参加（準備中）
          </button>
        </div>

        {/* ヘルプ */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800 font-medium mb-2">
            💡 招待コードの確認方法
          </p>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>保護者の方に「設定」→「家族管理」を開いてもらう</li>
            <li>表示された招待コードをコピーしてもらう</li>
            <li>LINEなどでコードを送ってもらう</li>
            <li>上の入力欄に貼り付けて「家族に参加」をタップ</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
