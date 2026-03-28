'use client';

import { useState } from 'react';
import { X, Gift } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface BirthMonthPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess?: () => void;
}

export function BirthMonthPromptModal({
  isOpen,
  onClose,
  userId,
  onSuccess,
}: BirthMonthPromptModalProps) {
  const [birthMonth, setBirthMonth] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!birthMonth) {
      alert('誕生月を選択してください');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          birth_month: birthMonth,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.error('誕生月登録エラー:', error);
        alert('登録に失敗しました');
        return;
      }

      alert('誕生月を登録しました！\nお誕生月にクーポンをお届けします🎁');
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('誕生月登録エラー:', err);
      alert('登録に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    // localStorageに「今日はスキップした」記録
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('birthMonthPrompt_lastSkip', today);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        {/* 閉じるボタン */}
        <button
          onClick={handleSkip}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          disabled={isSaving}
        >
          <X size={24} />
        </button>

        {/* アイコン */}
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Gift className="text-primary" size={48} />
          </div>
        </div>

        {/* タイトル */}
        <h3 className="mb-2 text-center text-xl font-bold text-gray-800">
          お誕生日クーポンを
          <br />
          受け取りませんか？🎂
        </h3>

        {/* 説明 */}
        <p className="mb-6 text-center text-sm text-gray-600">
          誕生月を登録すると、お誕生月に
          <br />
          <span className="font-semibold text-primary">特別クーポン</span>
          をお届けします！
        </p>

        {/* 誕生月選択 */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            誕生月を選択
          </label>
          <select
            value={birthMonth ?? ''}
            onChange={(e) =>
              setBirthMonth(e.target.value ? parseInt(e.target.value) : null)
            }
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            disabled={isSaving}
          >
            <option value="">選択してください</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
              <option key={month} value={month}>
                {month}月
              </option>
            ))}
          </select>
        </div>

        {/* ボタン */}
        <div className="space-y-3">
          <button
            onClick={handleSave}
            disabled={isSaving || !birthMonth}
            className="w-full rounded-lg bg-primary px-4 py-3.5 font-semibold text-white shadow-md transition-all hover:bg-primary-dark hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '登録中...' : '登録する'}
          </button>
          <button
            onClick={handleSkip}
            disabled={isSaving}
            className="w-full text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            今はスキップ
          </button>
        </div>

        {/* 注記 */}
        <p className="mt-4 text-center text-xs text-gray-500">
          ※ 誕生月の情報は、クーポン配信のみに使用します
        </p>
      </div>
    </div>
  );
}
