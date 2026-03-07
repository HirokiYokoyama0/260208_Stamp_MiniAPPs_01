'use client';

import { useEffect } from 'react';
import { useLiff } from '@/hooks/useLiff';
import { useLatestRecord, useHistoryRecords } from '@/lib/dental-records';
import ToothDiagram from '@/components/dental/ToothDiagram_v2';
import TreatmentTimeline from '@/components/dental/TreatmentTimeline';
import Legend from '@/components/dental/Legend';
import { logEvent } from '@/lib/analytics';

export default function AdultCarePage() {
  const { profile, isLoading, error } = useLiff();

  const { data: latestRecord, error: recordError } = useLatestRecord(profile?.userId);
  const { data: history, error: historyError } = useHistoryRecords(profile?.userId);

  // ページ閲覧ログ
  useEffect(() => {
    if (profile?.userId) {
      logEvent({
        eventName: 'care_record_page_view',
        userId: profile.userId,
        metadata: {
          has_records: !!latestRecord,
          record_count: history?.length || 0,
        },
      });
    }
  }, [profile?.userId, latestRecord, history]);

  // オドントグラム表示ログ
  useEffect(() => {
    if (latestRecord && profile?.userId) {
      const toothStatuses = Object.values(latestRecord.tooth_data || {});
      const hasCavity = toothStatuses.some((t: any) =>
        t.status === 'cavity_completed' || t.status === 'cavity_planned'
      );
      const hasObservation = toothStatuses.some((t: any) =>
        t.status === 'observation'
      );
      const hasInTreatment = toothStatuses.some((t: any) =>
        t.status === 'in_treatment'
      );

      logEvent({
        eventName: 'odontogram_view',
        userId: profile.userId,
        metadata: {
          total_teeth_with_status: toothStatuses.length,
          has_cavity: hasCavity,
          has_observation: hasObservation,
          has_in_treatment: hasInTreatment,
        },
      });
    }
  }, [latestRecord, profile?.userId]);

  // ローディング状態
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  // エラー状態
  if (error || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="text-center bg-white p-6 rounded-xl shadow-sm border border-red-100">
          <p className="text-red-500 mb-2 font-semibold">エラーが発生しました</p>
          <p className="text-gray-500 text-sm">{error?.message || 'ログインしてください'}</p>
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
        is_kids_mode: false,
      },
    });

    console.log('Tooth clicked:', toothNumber);
    // TODO: 歯の詳細モーダルを開く（Phase 3）
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-gray-800 text-center">マイデンタルマップ</h1>
          <p className="text-xs text-gray-400 text-center mt-0.5">あなたの歯の健康記録</p>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="px-4 pt-4">
        {/* 歯並び図 */}
        <section className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <ToothDiagram
            record={latestRecord ?? null}
            onToothClick={handleToothClick}
            isKidsMode={false}
          />
        </section>

        {/* 凡例 */}
        <Legend />

        {/* 次回予定メモ */}
        {latestRecord?.next_visit_memo && (
          <section className="mt-4 p-3 bg-blue-50 rounded-xl border-l-4 border-blue-400">
            <p className="text-xs font-semibold text-blue-900 mb-1">次回予定</p>
            <p className="text-sm text-blue-700">{latestRecord.next_visit_memo}</p>
          </section>
        )}

        {/* データがない場合の表示 */}
        {!latestRecord && !recordError && (
          <div className="mt-4 p-6 text-center bg-white rounded-xl border border-gray-100">
            <div className="text-4xl mb-3">🦷</div>
            <p className="text-gray-500 text-sm font-semibold mb-1">まだ治療記録がありません</p>
            <p className="text-gray-400 text-xs">
              次回の診療後に記録が表示されます
            </p>
          </div>
        )}

        {/* 治療履歴タイムライン */}
        {history && history.length > 0 && <TreatmentTimeline records={history} />}

        {/* エラー表示 */}
        {(recordError || historyError) && (
          <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-100">
            <p className="text-red-600 text-sm font-semibold">データの読み込みに失敗しました</p>
            <p className="text-red-400 text-xs mt-1">
              {recordError?.message || historyError?.message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
