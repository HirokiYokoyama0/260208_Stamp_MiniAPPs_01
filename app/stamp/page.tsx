'use client';

import { useViewMode } from '@/contexts/ViewModeContext';
import AdultStampPage from '@/components/(adult)/AdultStampPage';
import KidsStampPage from '@/components/(kids)/KidsStampPage';

export default function StampPage() {
  const { viewMode, isLoading } = useViewMode();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return viewMode === 'kids' ? <KidsStampPage /> : <AdultStampPage />;
}
