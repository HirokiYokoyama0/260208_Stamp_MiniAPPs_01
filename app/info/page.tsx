'use client';

import { useViewMode } from '@/contexts/ViewModeContext';
import AdultInfoPage from '@/components/(adult)/AdultInfoPage';
import KidsInfoPage from '@/components/(kids)/KidsInfoPage';

export default function InfoPage() {
  const { viewMode, isLoading } = useViewMode();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return viewMode === 'kids' ? <KidsInfoPage /> : <AdultInfoPage />;
}
