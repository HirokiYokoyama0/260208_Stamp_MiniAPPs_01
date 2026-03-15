'use client';

import { useEffect } from 'react';
import { useLiff } from '@/hooks/useLiff';
import { useLatestRecord, useHistoryRecords } from '@/lib/dental-records';
import ToothDiagram from '@/components/dental/ToothDiagram_v2';
import TreatmentTimeline from '@/components/dental/TreatmentTimeline';
import Legend from '@/components/dental/Legend';
import { logEvent } from '@/lib/analytics';

export default function KidsCarePage() {
  const { profile, isLoading, error } = useLiff();

  const { data: latestRecord, error: recordError } = useLatestRecord(profile?.userId);
  const { data: history, error: historyError } = useHistoryRecords(profile?.userId);

  // 子供モードでのケア記録閲覧ログ
  useEffect(() => {
    if (profile?.userId) {
      logEvent({
        eventName: 'care_record_kids_view',
        userId: profile.userId,
        metadata: {
          child_id: profile.userId,
          has_records: !!latestRecord,
          record_count: history?.length || 0,
        },
      });
    }
  }, [profile?.userId, latestRecord, history]);

  // 子供モードでのオドントグラム閲覧ログ
  useEffect(() => {
    if (latestRecord && profile?.userId) {
      const toothStatuses = Object.values(latestRecord.tooth_data || {});

      logEvent({
        eventName: 'care_record_kids_odontogram_view',
        userId: profile.userId,
        metadata: {
          child_id: profile.userId,
          teeth_with_status: toothStatuses.length,
        },
      });
    }
  }, [latestRecord, profile?.userId]);

  // ローディング状態
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-purple-100 via-blue-50 to-sky-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-kids-green mx-auto mb-4"></div>
          <p className="text-kids-green text-sm font-kids">よみこみちゅう...</p>
        </div>
      </div>
    );
  }

  // エラー状態
  if (error || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-purple-100 via-blue-50 to-sky-100 p-4">
        <div className="text-center bg-white p-6 rounded-2xl shadow-lg">
          <p className="text-4xl mb-3">😢</p>
          <p className="text-kids-green font-bold mb-2">エラーがおきました</p>
          <p className="text-gray-500 text-sm">{error?.message || 'ログインしてね'}</p>
        </div>
      </div>
    );
  }

  const handleToothClick = (toothNumber: string) => {
    const toothData = latestRecord?.tooth_data?.[toothNumber];

    // 歯の詳細クリックログ
    logEvent({
      eventName: 'tooth_detail_click',
      userId: profile?.userId,
      metadata: {
        tooth_number: toothNumber,
        status: toothData?.status || null,
        color: toothData?.color || null,
        is_kids_mode: true,
      },
    });

    console.log('Tooth clicked:', toothNumber);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 via-blue-50 to-sky-100 pb-20 font-kids">
      {/* ヘッダー */}
      <header className="bg-white/90 shadow-sm border-b border-kids-green/20 sticky top-0 z-10">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-kids-green text-center">わたしのはのきろく</h1>
          <p className="text-xs text-kids-purple text-center mt-0.5">✨ きれいなはをたもとう ✨</p>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="px-4 pt-4">
        {/* 歯並び図 */}
        <section className="bg-white/90 rounded-2xl p-4 shadow-lg border-2 border-kids-green/30">
          <ToothDiagram
            record={latestRecord ?? null}
            onToothClick={handleToothClick}
            isKidsMode={true}
          />
        </section>

        {/* 凡例 */}
        <Legend />

        {/* 次回予定メモ */}
        {latestRecord?.next_visit_memo && (
          <section className="mt-4 p-3 bg-kids-blue/20 rounded-2xl border-l-4 border-kids-blue">
            <p className="text-xs font-bold text-kids-blue mb-1">つぎのよてい</p>
            <p className="text-sm text-gray-700">{latestRecord.next_visit_memo}</p>
          </section>
        )}

        {/* データがない場合の表示 */}
        {!latestRecord && !recordError && (
          <div className="mt-4 p-6 text-center bg-white/90 rounded-2xl border-2 border-kids-green/30">
            <div className="text-5xl mb-3">🦷✨</div>
            <p className="text-kids-green text-sm font-bold mb-1">まだきろくがないよ</p>
            <p className="text-gray-500 text-xs">
              つぎのしんさつのあとにみられるよ
            </p>
          </div>
        )}

        {/* 治療履歴タイムライン */}
        {history && history.length > 0 && <TreatmentTimeline records={history} />}

        {/* エラー表示 */}
        {(recordError || historyError) && (
          <div className="mt-4 p-4 bg-red-50 rounded-2xl border-2 border-red-200">
            <p className="text-red-600 text-sm font-bold">データがよみこめませんでした</p>
            <p className="text-red-400 text-xs mt-1">
              {recordError?.message || historyError?.message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
