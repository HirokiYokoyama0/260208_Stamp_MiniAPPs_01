'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useViewMode } from '@/contexts/ViewModeContext';
import AdultHome from '@/components/(adult)/AdultHome';
import KidsHome from '@/components/(kids)/KidsHome';

function HomeContent() {
  const { viewMode, isLoading } = useViewMode();
  const router = useRouter();
  const searchParams = useSearchParams();

  // URLパラメータチェック: action=stamp の場合は auto-stamp ページにリダイレクト
  useEffect(() => {
    const action = searchParams.get('action');
    const type = searchParams.get('type');
    const amount = searchParams.get('amount');

    if (action === 'stamp' && (type === 'qr' || type === 'purchase') && amount) {
      console.log('[HomePage] QRスタンプアクション検出 → /auto-stamp にリダイレクト');
      const location = searchParams.get('location');
      const params = new URLSearchParams({
        action,
        type,
        amount,
        ...(location && { location }),
      });
      router.push(`/auto-stamp?${params.toString()}`);
    }
  }, [searchParams, router]);

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

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
