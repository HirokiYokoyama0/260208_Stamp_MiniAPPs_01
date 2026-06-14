'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useViewMode } from '@/contexts/ViewModeContext';
import { logAutoStampEntry } from '@/lib/analytics';
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
    const location = searchParams.get('location');
    const rawQuery = typeof window !== 'undefined' ? window.location.search : '';
    const willRedirect =
      action === 'stamp' && (type === 'qr' || type === 'purchase') && !!amount;

    // LIFF第1段階の着地（?liff.state=... に本来のクエリが埋まっている）をデコードして補完
    // 目的: 第1段階で止まった失敗ケースでも「何のQRだったか」をログに残す
    // 注意: 実際のリダイレクト判定（willRedirect）には影響させない（ログのenrichのみ）
    const liffState = searchParams.get('liff.state');
    let effAction = action;
    let effType = type;
    let effAmount = amount;
    let effLocation = location;
    let fromLiffState = false;
    if (liffState && (!action || !type || !amount)) {
      try {
        const inner = new URLSearchParams(
          liffState.startsWith('?') ? liffState.slice(1) : liffState
        );
        if (inner.get('action') || inner.get('type') || inner.get('amount')) {
          effAction = action ?? inner.get('action');
          effType = type ?? inner.get('type');
          effAmount = amount ?? inner.get('amount');
          effLocation = location ?? inner.get('location');
          fromLiffState = true;
        }
      } catch {
        // デコード失敗は無視（ログのenrich目的のため、本処理に影響させない）
      }
    }

    // パラメータ付きで開かれた時だけ着地ログを記録（通常のホーム閲覧では撒かない）
    // fire-and-forget（await しない）。userIdはここでは取得しない（liff.init二重化を避けるため）
    if (rawQuery) {
      void logAutoStampEntry({
        rawQuery,
        action: effAction,
        type: effType,
        amount: effAmount,
        location: effLocation,
        redirected: willRedirect,
        liffState: liffState ?? null,
        fromLiffState,
      });
    }

    if (willRedirect && amount) {
      console.log('[HomePage] QRスタンプアクション検出 → /auto-stamp にリダイレクト');
      const params = new URLSearchParams({
        action: action!,
        type: type!,
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
