'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiff } from '@/hooks/useLiff';
import { Users, Loader2, ArrowLeft, Baby } from 'lucide-react';
import Link from 'next/link';

export default function FamilyCreatePage() {
  const router = useRouter();
  const { profile, isLoading: liffLoading } = useLiff();
  const [familyName, setFamilyName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (!profile?.userId) {
      setError('ユーザー情報を取得できませんでした');
      return;
    }

    if (!familyName.trim()) {
      setError('家族名を入力してください');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/families/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.userId,
          familyName: familyName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '家族の作成に失敗しました');
      }

      console.log('✅ 家族作成成功:', data);

      // 成功 → 家族管理画面へ
      router.push('/family/manage');
    } catch (err) {
      console.error('家族作成エラー:', err);
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
      setIsLoading(false);
    }
  };

  if (liffLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/10 to-white">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-white px-4 py-8">
      <div className="max-w-md mx-auto">
        {/* 戻るボタン */}
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft size={20} />
          <span>設定に戻る</span>
        </Link>

        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={40} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">家族グループを作成</h1>
          <p className="text-gray-600 text-sm">
            家族のスタンプを一緒に貯めましょう！<br />
            まずは家族の名前を決めてください
          </p>
        </div>

        {/* 入力フォーム */}
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              家族名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="例: 山田ファミリー"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              disabled={isLoading}
              maxLength={50}
            />
            <p className="mt-2 text-xs text-gray-500">
              ※ 後から変更できます
            </p>
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* 作成ボタン */}
          <button
            onClick={handleCreate}
            disabled={!familyName.trim() || isLoading}
            className="w-full bg-primary text-white font-semibold py-3 rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                作成中...
              </>
            ) : (
              '家族グループを作成'
            )}
          </button>
        </div>

        {/* 次のステップの案内 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800 font-medium mb-2">
            📌 家族グループ作成後にできること
          </p>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>スマホを持っている家族を招待コードで招待</li>
            <li>小さなお子様（スマホなし）を代理登録</li>
            <li>家族全員のスタンプを合計して確認</li>
            <li>お子様専用の画面（キッズモード）を開く</li>
          </ul>
        </div>

        {/* スマホなし子供について */}
        <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Baby size={18} className="text-purple-600" />
            <p className="text-sm text-purple-800 font-medium">
              小さなお子様について
            </p>
          </div>
          <p className="text-sm text-purple-700">
            スマホを持っていない小さなお子様は、家族グループ作成後に「スマホなしの子供を追加」ボタンから登録できます。
          </p>
        </div>
      </div>
    </div>
  );
}
