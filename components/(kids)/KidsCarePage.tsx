'use client';

import { useEffect, useState, useRef } from 'react';
import { useLiff } from '@/hooks/useLiff';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useRouter } from 'next/navigation';
import { useLatestRecord, useHistoryRecords } from '@/lib/dental-records';
import ToothDiagram from '@/components/dental/ToothDiagram_v2';
import TreatmentTimeline from '@/components/dental/TreatmentTimeline';
import Legend from '@/components/dental/Legend';
import { logEvent } from '@/lib/analytics';
import { Lock, ArrowLeft } from 'lucide-react';

export default function KidsCarePage() {
  const { profile, isLoading, error } = useLiff();
  const { viewMode, setSelectedChildId, setViewMode } = useViewMode();
  const router = useRouter();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdStartTimeRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: latestRecord, error: recordError } = useLatestRecord(profile?.userId);
  const { data: history, error: historyError } = useHistoryRecords(profile?.userId);

  // 親の画面に戻る
  const handleBackToParent = async () => {
    setSelectedChildId(null);
    await setViewMode('adult');
    router.push('/');
  };

  // 長押し開始ハンドラー
  const handlePressStart = () => {
    if (isUnlocked) return;

    holdStartTimeRef.current = Date.now();

    // 3秒後にアンロック
    holdTimerRef.current = setTimeout(() => {
      setIsUnlocked(true);
      setHoldProgress(100);

      // アンロック成功ログ
      logEvent({
        eventName: 'care_record_kids_unlocked',
        userId: profile?.userId,
        metadata: {
          unlock_method: 'long_press',
        },
      });
    }, 3000);

    // プログレスバー更新（100ms毎）
    progressIntervalRef.current = setInterval(() => {
      if (holdStartTimeRef.current) {
        const elapsed = Date.now() - holdStartTimeRef.current;
        const progress = Math.min((elapsed / 3000) * 100, 100);
        setHoldProgress(progress);
      }
    }, 100);
  };

  // 長押し終了ハンドラー
  const handlePressEnd = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    holdStartTimeRef.current = null;
    setHoldProgress(0);
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-kids-yellow to-kids-pink">
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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-kids-yellow to-kids-pink p-4">
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
    <div className="min-h-screen bg-gradient-to-br from-kids-yellow to-kids-pink pb-20 font-kids relative">
      {/* ヘッダー */}
      <header className="bg-white/90 shadow-sm border-b border-kids-green/20 sticky top-0 z-10">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-kids-green text-center">わたしのはのきろく</h1>
          <p className="text-xs text-kids-purple text-center mt-0.5">✨ きれいなはをたもとう ✨</p>
        </div>
      </header>

      {/* 親の画面に戻るボタン（キッズモードの場合に表示） */}
      {viewMode === 'kids' && (
        <div className="px-4 pt-4">
          <button
            onClick={handleBackToParent}
            className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-kids-purple shadow-lg transition-all hover:bg-white active:scale-95"
          >
            <ArrowLeft size={20} />
            おやの がめんに もどる
          </button>
        </div>
      )}

      {/* ロック画面オーバーレイ（キッズ風） */}
      {!isUnlocked && (
        <div
          className="fixed inset-0 bg-kids-purple/80 backdrop-blur-sm z-50 flex items-center justify-center"
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressEnd}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
          onTouchCancel={handlePressEnd}
        >
          <div className="text-center px-6">
            {/* ロックアイコン */}
            <div className="mb-6">
              <Lock size={64} className="text-white mx-auto" strokeWidth={2} />
            </div>

            {/* 説明文（キッズ風） */}
            <h2 className="text-white text-2xl font-bold mb-2">はのきろくをみる</h2>
            <p className="text-kids-yellow text-base mb-6">
              ながおしして 3びょう まってね
            </p>

            {/* プログレスバー（キッズ風カラフル） */}
            <div className="w-64 h-4 bg-white/20 rounded-full overflow-hidden mx-auto border-2 border-white/30">
              <div
                className="h-full bg-gradient-to-r from-kids-yellow via-kids-pink to-kids-green transition-all duration-100 ease-linear"
                style={{ width: `${holdProgress}%` }}
              />
            </div>

            {/* 進捗テキスト */}
            <p className="text-white text-sm mt-4">
              {holdProgress > 0 ? `${Math.floor(holdProgress)}% 🌟` : 'がめんを ながおし してね 👆'}
            </p>
          </div>
        </div>
      )}

      {/* メインコンテンツ */}
      <div className={`px-4 pt-4 ${!isUnlocked ? 'blur-sm pointer-events-none' : ''}`}>
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
