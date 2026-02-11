'use client';

import { useViewMode } from '@/contexts/ViewModeContext';
import { Baby, User } from 'lucide-react';

export default function SettingsPage() {
  const { viewMode, setViewMode, isLoading } = useViewMode();

  const handleModeChange = async (mode: 'adult' | 'kids') => {
    await setViewMode(mode);
  };

  return (
    <div className="px-4 py-6">
      <h2 className="mb-6 text-lg font-semibold text-gray-800">設定</h2>

      {/* 表示モード選択 */}
      <section className="mb-6">
        <h3 className="mb-3 text-sm font-medium text-gray-700">表示モード</h3>
        <div className="space-y-3">
          {/* 大人用 */}
          <button
            onClick={() => handleModeChange('adult')}
            disabled={isLoading}
            className={`flex w-full items-center gap-4 rounded-lg border-2 p-4 transition-all ${
              viewMode === 'adult'
                ? 'border-primary bg-primary/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <User size={32} className={viewMode === 'adult' ? 'text-primary' : 'text-gray-400'} />
            <div className="flex-1 text-left">
              <p className="font-semibold text-gray-800">大人用</p>
              <p className="text-xs text-gray-500">落ち着いたデザイン</p>
            </div>
            {viewMode === 'adult' && (
              <span className="text-xs font-medium text-primary">選択中</span>
            )}
          </button>

          {/* 子供用 */}
          <button
            onClick={() => handleModeChange('kids')}
            disabled={isLoading}
            className={`flex w-full items-center gap-4 rounded-lg border-2 p-4 transition-all ${
              viewMode === 'kids'
                ? 'border-kids-pink bg-kids-pink/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Baby size={32} className={viewMode === 'kids' ? 'text-kids-pink' : 'text-gray-400'} />
            <div className="flex-1 text-left">
              <p className="font-semibold text-gray-800">子供用</p>
              <p className="text-xs text-gray-500">楽しくカラフルなデザイン</p>
            </div>
            {viewMode === 'kids' && (
              <span className="text-xs font-medium text-kids-pink">選択中</span>
            )}
          </button>
        </div>
      </section>

      {/* 説明 */}
      <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
        <p>表示モードはいつでも変更できます。</p>
        <p className="mt-2">スタンプや特典のデータは共通です。</p>
      </div>
    </div>
  );
}
