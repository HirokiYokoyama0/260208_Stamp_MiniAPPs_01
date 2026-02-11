'use client';

import { useViewMode } from '@/contexts/ViewModeContext';
import AdultRewardsPage from '@/components/(adult)/AdultRewardsPage';
import KidsRewardsPage from '@/components/(kids)/KidsRewardsPage';

export default function RewardsPage() {
  const { viewMode, isLoading } = useViewMode();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return viewMode === 'kids' ? <KidsRewardsPage /> : <AdultRewardsPage />;
}
