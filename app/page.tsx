'use client';

import { useViewMode } from '@/contexts/ViewModeContext';
import AdultHome from '@/components/(adult)/AdultHome';
import KidsHome from '@/components/(kids)/KidsHome';

export default function HomePage() {
  const { viewMode, isLoading } = useViewMode();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  return viewMode === 'kids' ? <KidsHome /> : <AdultHome />;
}
