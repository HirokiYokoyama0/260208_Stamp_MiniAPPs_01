'use client';

import { useViewMode } from '@/contexts/ViewModeContext';
import AdultCarePage from '@/components/(adult)/AdultCarePage';
import KidsCarePage from '@/components/(kids)/KidsCarePage';

export default function CarePage() {
  const { viewMode, isLoading } = useViewMode();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return viewMode === 'kids' ? <KidsCarePage /> : <AdultCarePage />;
}
