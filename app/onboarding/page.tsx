'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiff } from '@/hooks/useLiff';
import { User, Baby, Loader2, CreditCard } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const { profile, isLoading: liffLoading } = useLiff();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Step管理
  const [step, setStep] = useState<'profile' | 'role'>('profile');

  // プロフィール入力
  const [ticketNumber, setTicketNumber] = useState('');
  const [realName, setRealName] = useState('');

  // Step 1: プロフィール入力完了
  const handleProfileSubmit = async () => {
    // バリデーション
    if (!ticketNumber.trim()) {
      setError('診察券番号を入力してください');
      return;
    }

    if (!realName.trim()) {
      setError('お名前を入力してください');
      return;
    }

    setError('');
    setStep('role'); // 次のステップへ
  };

  // Step 2: 役割選択
  const handleSelectRole = async (role: 'parent' | 'child') => {
    if (!profile?.userId) {
      setError('ユーザー情報を取得できませんでした');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 役割設定と同時に診察券番号・本名も保存
      const res = await fetch('/api/users/setup-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.userId,
          role,
          ticketNumber: ticketNumber.trim(),
          realName: realName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '役割の設定に失敗しました');
      }

      console.log('✅ 役割設定完了:', data);

      if (role === 'parent') {
        // 親の場合: 家族作成完了 → ホーム画面へ
        router.push('/');
      } else {
        // 子の場合: 家族参加フローへ
        router.push('/family/join');
      }
    } catch (err) {
      console.error('役割設定エラー:', err);
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
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-white px-4 py-12">
      <div className="max-w-md mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            ようこそ！
          </h1>
          <p className="text-gray-600">
            つくばホワイト歯科の<br />
            デジタルスタンプカードへ
          </p>
        </div>

        {/* プログレスインジケーター */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className={`h-2 w-16 rounded-full ${step === 'profile' ? 'bg-primary' : 'bg-primary/30'}`} />
          <div className={`h-2 w-16 rounded-full ${step === 'role' ? 'bg-primary' : 'bg-gray-200'}`} />
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Step 1: プロフィール入力 */}
        {step === 'profile' && (
          <div className="space-y-6">
            {/* 説明 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <CreditCard className="text-primary" size={24} />
                <h2 className="text-lg font-bold text-gray-800">患者情報の入力</h2>
              </div>
              <p className="text-sm text-gray-600">
                診察券番号とお名前を入力してください
              </p>
            </div>

            {/* 入力フォーム */}
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">
              {/* 診察券番号 */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  診察券番号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={ticketNumber}
                  onChange={(e) => setTicketNumber(e.target.value)}
                  placeholder="例: 123456"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1 text-xs text-gray-500">
                  診察券に記載されている番号を入力してください
                </p>
              </div>

              {/* 氏名（本名） */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  お名前（本名） <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={realName}
                  onChange={(e) => setRealName(e.target.value)}
                  placeholder="例: 山田 太郎"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1 text-xs text-gray-500">
                  診察券に記載されているお名前を入力してください
                </p>
              </div>
            </div>

            {/* 次へボタン */}
            <button
              onClick={handleProfileSubmit}
              className="w-full rounded-lg bg-primary px-6 py-4 font-bold text-white shadow-md transition-all hover:bg-primary-dark hover:shadow-lg active:scale-[0.98]"
            >
              次へ
            </button>

            {/* 注意事項 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs text-blue-800">
                ※ 診察券番号をお持ちでない方は、受付でご登録をお願いします
              </p>
            </div>
          </div>
        )}

        {/* Step 2: 役割選択 */}
        {step === 'role' && (
          <div className="space-y-6">
            {/* 説明 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <p className="text-center text-gray-700 mb-2">
                あなたはどちらですか？
              </p>
              <p className="text-center text-sm text-gray-500">
                家族でスタンプを協力して貯められます
              </p>
            </div>

            {/* 役割選択ボタン */}
            <div className="space-y-4">
              {/* 保護者ボタン */}
              <button
                onClick={() => handleSelectRole('parent')}
                disabled={isLoading}
                className="w-full flex items-center gap-4 p-6 bg-white border-2 border-primary rounded-xl shadow-lg hover:shadow-xl hover:border-primary-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  {isLoading ? (
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  ) : (
                    <User size={32} className="text-primary" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-lg font-bold text-gray-800">保護者（親）</p>
                  <p className="text-sm text-gray-500">家族を作成します</p>
                </div>
                <span className="text-gray-400 text-2xl">›</span>
              </button>

              {/* 子どもボタン */}
              <button
                onClick={() => handleSelectRole('child')}
                disabled={isLoading}
                className="w-full flex items-center gap-4 p-6 bg-white border-2 border-kids-pink rounded-xl shadow-lg hover:shadow-xl hover:border-kids-pink/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-16 h-16 bg-kids-pink/10 rounded-full flex items-center justify-center flex-shrink-0">
                  {isLoading ? (
                    <Loader2 className="w-8 h-8 text-kids-pink animate-spin" />
                  ) : (
                    <Baby size={32} className="text-kids-pink" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-lg font-bold text-gray-800">お子様</p>
                  <p className="text-sm text-gray-500">家族に参加します</p>
                </div>
                <span className="text-gray-400 text-2xl">›</span>
              </button>
            </div>

            {/* 戻るボタン */}
            <button
              onClick={() => setStep('profile')}
              disabled={isLoading}
              className="w-full text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              ← 戻る
            </button>

            {/* フッター説明 */}
            <div className="text-center">
              <p className="text-xs text-gray-500">
                ※後から変更することはできません
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
