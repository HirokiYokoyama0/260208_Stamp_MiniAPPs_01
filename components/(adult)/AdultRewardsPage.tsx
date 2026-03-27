"use client";

import { useEffect, useState } from "react";
import { useLiff } from "@/hooks/useLiff";
import { Gift, CheckCircle2, Clock, Check, X } from "lucide-react";
import {
  exchangeReward,
  fetchUserExchangeHistory,
} from "@/lib/rewards";
import { fetchStampCount, calculateStampDisplay } from "@/lib/stamps";
import { MilestoneReward, RewardExchange } from "@/types/reward";
import { supabase } from "@/lib/supabase";
import { getMilestoneDescription } from "@/lib/milestones";

// マイルストーン型特典を表示用に拡張
interface MilestoneRewardWithStatus extends MilestoneReward {
  canExchange: boolean; // 到達済みかどうか
  isPending: boolean; // 申請中
  isCompleted: boolean; // 引渡済み
  isCancelled: boolean; // キャンセル済み
  isExpired: boolean; // 期限切れ
  latestExchange: RewardExchange | null;
  nextMilestone: number; // 次のマイルストーン
  validUntil: string | null; // 有効期限
  daysRemaining: number | null; // 残り日数
}

export default function AdultRewardsPage() {
  const { isInitialized, isLoggedIn, isLoading, profile, login } = useLiff();
  const [rewards, setRewards] = useState<MilestoneRewardWithStatus[]>([]);
  const [stampCount, setStampCount] = useState(0);
  const [familyStampCount, setFamilyStampCount] = useState<number | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [exchangeHistory, setExchangeHistory] = useState<RewardExchange[]>([]);
  const [isLoadingRewards, setIsLoadingRewards] = useState(true);
  const [isExchanging, setIsExchanging] = useState(false);

  // 有効期限チェック関数
  const checkExpiration = (exchange: RewardExchange | null): { isExpired: boolean; daysRemaining: number | null } => {
    if (!exchange || !exchange.valid_until) {
      return { isExpired: false, daysRemaining: null };
    }

    const now = new Date();
    const validUntil = new Date(exchange.valid_until);
    const isExpired = validUntil < now;

    // 残り日数を計算
    const diffMs = validUntil.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return {
      isExpired,
      daysRemaining: isExpired ? null : diffDays,
    };
  };

  // 日付フォーマット関数
  const formatValidUntil = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  // 特典交換に使用するスタンプ数（家族がいる場合は家族合算、いない場合は個人）
  const effectiveStampCount = familyId && familyStampCount !== null ? familyStampCount : stampCount;

  // 10倍整数システム対応のスタンプ表示
  const { fullStamps, progress } = calculateStampDisplay(effectiveStampCount);

  // 現在のスタンプ数から表示範囲を計算（500スタンプ区切り）
  const calculateDisplayRange = (stampCount: number) => {
    const { fullStamps } = calculateStampDisplay(stampCount);
    const rangeStart = Math.floor(fullStamps / 500) * 500;
    const rangeEnd = rangeStart + 500;
    return { rangeStart, rangeEnd };
  };

  // 特典の優先度を取得
  const getRewardPriority = (milestoneType: string): number => {
    if (milestoneType === 'every_150_from_300') return 3; // 最優先
    if (milestoneType === 'every_50') return 2;
    if (milestoneType === 'every_10') return 1; // 最低優先
    return 0;
  };

  // 指定範囲内の特典マイルストーンを生成（優先度ルール適用）
  const generateMilestonesInRange = (
    milestoneRewards: MilestoneReward[],
    rangeStart: number,
    rangeEnd: number,
    currentStampCount: number,
    history: RewardExchange[]
  ): MilestoneRewardWithStatus[] => {
    const { fullStamps: currentFullStamps } = calculateStampDisplay(currentStampCount);

    // マイルストーンごとに候補となる特典を収集
    const milestoneMap = new Map<number, MilestoneRewardWithStatus[]>();

    // 各特典タイプごとにマイルストーンを生成
    for (const reward of milestoneRewards) {
      let milestones: number[] = [];

      if (reward.milestone_type === 'every_10') {
        // 10の倍数
        for (let m = Math.max(10, rangeStart); m < rangeEnd; m += 10) {
          if (m >= 10) milestones.push(m);
        }
      } else if (reward.milestone_type === 'every_50') {
        // 50の倍数
        for (let m = Math.max(50, rangeStart); m < rangeEnd; m += 50) {
          if (m >= 50) milestones.push(m);
        }
      } else if (reward.milestone_type === 'every_150_from_300') {
        // 300, 450, 600...
        if (rangeEnd > 300) {
          if (rangeStart <= 300) milestones.push(300);
          for (let m = 450; m < rangeEnd; m += 150) {
            if (m >= rangeStart) milestones.push(m);
          }
        }
      }

      // 各マイルストーンごとに特典インスタンスを作成
      for (const milestone of milestones) {
        // このマイルストーンでの交換履歴を取得
        const latestExchange = history
          .filter(h =>
            h.reward_id === reward.id &&
            h.is_milestone_based === true &&
            h.milestone_reached === milestone
          )
          .sort((a, b) => new Date(b.exchanged_at).getTime() - new Date(a.exchanged_at).getTime())[0] || null;

        // 有効期限チェック
        const expirationCheck = latestExchange?.valid_until
          ? (() => {
              const now = new Date();
              const validUntil = new Date(latestExchange.valid_until);
              const isExpired = validUntil < now;
              const diffMs = validUntil.getTime() - now.getTime();
              const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
              return {
                isExpired,
                daysRemaining: isExpired ? null : diffDays,
              };
            })()
          : { isExpired: false, daysRemaining: null };

        const rewardWithStatus: MilestoneRewardWithStatus = {
          ...reward,
          canExchange: currentFullStamps >= milestone,
          isPending: latestExchange?.status === 'pending',
          isCompleted: latestExchange?.status === 'completed',
          isCancelled: latestExchange?.status === 'cancelled',
          isExpired: latestExchange?.status === 'expired' || expirationCheck.isExpired,
          latestExchange,
          nextMilestone: milestone,
          validUntil: latestExchange?.valid_until || null,
          daysRemaining: expirationCheck.daysRemaining,
        };

        // マイルストーンごとにグループ化
        if (!milestoneMap.has(milestone)) {
          milestoneMap.set(milestone, []);
        }
        milestoneMap.get(milestone)!.push(rewardWithStatus);
      }
    }

    // 優先度ルールを適用：各マイルストーンで最も優先度の高い特典のみを選択
    const result: MilestoneRewardWithStatus[] = [];
    for (const [milestone, candidates] of milestoneMap.entries()) {
      // 優先度でソートして最上位のみ取得
      const sortedCandidates = candidates.sort((a, b) =>
        getRewardPriority(b.milestone_type) - getRewardPriority(a.milestone_type)
      );
      result.push(sortedCandidates[0]);
    }

    // マイルストーン順にソート
    return result.sort((a, b) => a.nextMilestone - b.nextMilestone);
  };

  // 特典一覧とスタンプ数、交換履歴を取得
  useEffect(() => {
    const loadData = async () => {
      if (!isLoggedIn || !profile?.userId) return;

      setIsLoadingRewards(true);
      try {
        // 1. 期限切れの自動更新（Phase 2推奨機能）
        await supabase
          .from("reward_exchanges")
          .update({ status: "expired" })
          .eq("user_id", profile.userId)
          .eq("status", "pending")
          .lt("valid_until", new Date().toISOString())
          .not("valid_until", "is", null);

        // 2. 並行して取得
        const [count, history, profileData] = await Promise.all([
          fetchStampCount(profile.userId),
          fetchUserExchangeHistory(profile.userId),
          supabase
            .from("profiles")
            .select("family_id")
            .eq("id", profile.userId)
            .single(),
        ]);

        setStampCount(count);
        setExchangeHistory(history);

        // マイルストーン型特典を取得
        const { data: milestoneData, error } = await supabase
          .from("milestone_rewards")
          .select("*")
          .eq("is_active", true)
          .order("display_order", { ascending: true });

        if (error) {
          console.error("❌ マイルストーン型特典取得エラー:", error);
          return;
        }

        const milestoneRewards = milestoneData as MilestoneReward[];

        // 家族IDを取得
        const userFamilyId = profileData.data?.family_id || null;
        setFamilyId(userFamilyId);

        // 家族に所属している場合、家族全体のスタンプ数を取得
        let displayStampCount = count;
        if (userFamilyId) {
          const { data: familyData } = await supabase
            .from("family_stamp_totals")
            .select("total_stamp_count")
            .eq("family_id", userFamilyId)
            .single();

          if (familyData) {
            setFamilyStampCount(familyData.total_stamp_count ?? 0);
            displayStampCount = familyData.total_stamp_count ?? 0;
          } else {
            setFamilyStampCount(null);
          }
        } else {
          setFamilyStampCount(null);
        }

        // 現在のスタンプ数に応じた表示範囲を計算
        const { rangeStart, rangeEnd } = calculateDisplayRange(displayStampCount);
        const milestonesInRange = generateMilestonesInRange(
          milestoneRewards,
          rangeStart,
          rangeEnd,
          displayStampCount,
          history
        );
        setRewards(milestonesInRange);
      } catch (error) {
        console.error("❌ データ取得エラー:", error);
      } finally {
        setIsLoadingRewards(false);
      }
    };

    loadData();
  }, [isLoggedIn, profile]);

  // 特典交換処理
  const handleExchange = async (rewardId: string, rewardName: string, milestone: number) => {
    if (!profile?.userId) return;

    const confirmed = window.confirm(
      `「${rewardName}」と交換しますか？\n\n✨ スタンプは交換後も減りません\n\n受付でお受け取りください。`
    );

    if (!confirmed) return;

    setIsExchanging(true);
    try {
      console.log('🔄 交換リクエスト送信:', { userId: profile.userId, rewardId, milestone });
      const result = await exchangeReward(profile.userId, rewardId, milestone);
      console.log('📥 交換結果:', result);

      if (result.success) {
        alert(result.message);

        console.log('🔄 交換履歴とスタンプ数を再取得中...');
        // 交換履歴を再取得して状態を更新
        const [newHistory, newCount] = await Promise.all([
          fetchUserExchangeHistory(profile.userId),
          fetchStampCount(profile.userId),
        ]);

        console.log('📊 新しい交換履歴:', newHistory);
        console.log('📊 新しいスタンプ数:', newCount);

        setExchangeHistory(newHistory);
        setStampCount(newCount);

        // マイルストーン型特典を再取得
        const { data: milestoneData } = await supabase
          .from("milestone_rewards")
          .select("*")
          .eq("is_active", true)
          .order("display_order", { ascending: true });

        const milestoneRewards = milestoneData as MilestoneReward[];

        // 家族がいる場合は家族スタンプ数も再取得
        let displayStampCount = newCount;
        if (familyId) {
          const { data: familyData } = await supabase
            .from("family_stamp_totals")
            .select("total_stamp_count")
            .eq("family_id", familyId)
            .single();

          if (familyData) {
            setFamilyStampCount(familyData.total_stamp_count ?? 0);
            displayStampCount = familyData.total_stamp_count ?? 0;
          }
        }

        // 現在のスタンプ数に応じた表示範囲を計算
        const { rangeStart, rangeEnd } = calculateDisplayRange(displayStampCount);
        console.log('📍 表示範囲:', { rangeStart, rangeEnd, displayStampCount });

        const milestonesInRange = generateMilestonesInRange(
          milestoneRewards,
          rangeStart,
          rangeEnd,
          displayStampCount,
          newHistory
        );
        console.log('🎁 生成された特典リスト:', milestonesInRange.map(r => ({
          name: r.name,
          milestone: r.nextMilestone,
          isPending: r.isPending,
          isCompleted: r.isCompleted
        })));

        setRewards(milestonesInRange);
        console.log('✅ UI更新完了');
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error("❌ 特典交換エラー:", error);
      alert("エラーが発生しました");
    } finally {
      setIsExchanging(false);
    }
  };

  // ローディング中
  if (!isInitialized || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 未ログイン
  if (!isLoggedIn) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6">
        <p className="mb-6 text-center text-gray-600">
          LINEでログインして
          <br />
          特典をご利用ください
        </p>
        <button
          type="button"
          onClick={login}
          className="rounded-lg bg-[#06C755] px-8 py-3 font-medium text-white transition-colors hover:bg-[#05b04c]"
        >
          LINEでログイン
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-6">
      {/* ヘッダー */}
      <section className="rounded-xl border border-gray-100 bg-gradient-to-br from-primary/5 to-primary/10 p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <Gift size={24} className="text-primary-dark" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-800">
              特典交換ページ
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              貯まったスタンプで特典と交換できます
            </p>
            <p className="mt-1 text-xs font-medium text-primary-dark">
              ✨ スタンプは交換後も減りません
            </p>
          </div>
        </div>

        {/* 特典ルールの説明 */}
        <div className="mt-4 rounded-lg bg-white/60 p-3 text-xs text-gray-700">
          <p className="font-medium text-gray-800 mb-2">🎁 特典の種類</p>
          <ul className="space-y-1">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span><span className="font-medium">10の倍数</span>：歯ブラシ 1本</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span><span className="font-medium">50の倍数</span>：POIC殺菌剤（初回本体込み）</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span><span className="font-medium">300個到達、以降150ごと</span>：選べるメニュー割引</span>
            </li>
          </ul>
          <p className="mt-2 text-gray-500">
            ※ 複数の倍数に該当する場合、より上位の特典のみが付与されます
          </p>
        </div>
      </section>

      {/* 現在のスタンプ数 */}
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="text-xs text-gray-500">
          {familyId && familyStampCount !== null ? "家族全体のスタンプ数" : "現在のスタンプ数"}
        </p>
        <p className={`mt-2 text-4xl font-bold ${familyId && familyStampCount !== null ? "text-purple-600" : "text-primary"}`}>
          {fullStamps}個
        </p>
        {familyId && familyStampCount !== null && (
          <p className="mt-2 text-xs text-gray-500">
            あなたのスタンプ: {calculateStampDisplay(stampCount).fullStamps}個
          </p>
        )}
        {progress > 0 && (
          <div className="mt-3 rounded-lg bg-sky-50 p-2">
            <p className="text-xs text-sky-700 font-medium">
              次のスタンプまで: {progress}%
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sky-100">
              <div
                className="h-full rounded-full bg-sky-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* 特典一覧 */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400">
            交換できる特典
          </h2>
          <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {Math.floor(fullStamps / 500) * 500} - {Math.floor(fullStamps / 500) * 500 + 500}スタンプ
          </div>
        </div>

        {isLoadingRewards ? (
          <div className="text-center text-sm text-gray-400">読み込み中...</div>
        ) : rewards.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-gray-500">特典がありません</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {rewards.map((reward) => (
              <li
                key={`${reward.id}-${reward.nextMilestone}`}
                className={`rounded-xl border bg-white p-5 shadow-sm transition-all ${
                  reward.isExpired
                    ? "border-gray-300 bg-gray-50"
                    : reward.isCompleted
                    ? "border-green-300 bg-green-50"
                    : reward.isCancelled
                    ? "border-red-300 bg-red-50"
                    : reward.isPending
                    ? "border-yellow-300 bg-yellow-50"
                    : reward.canExchange
                    ? "border-primary/30 bg-primary/5"
                    : "border-gray-100"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* アイコン */}
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${
                      reward.isExpired
                        ? "bg-gray-200"
                        : reward.isCompleted
                        ? "bg-green-200"
                        : reward.isCancelled
                        ? "bg-red-200"
                        : reward.isPending
                        ? "bg-yellow-200"
                        : reward.canExchange
                        ? "bg-primary/20"
                        : "bg-gray-100"
                    }`}
                  >
                    {reward.isExpired ? (
                      <X size={28} className="text-gray-600" strokeWidth={2} />
                    ) : reward.isCompleted ? (
                      <Check
                        size={28}
                        className="text-green-600"
                        strokeWidth={2}
                      />
                    ) : reward.isCancelled ? (
                      <X size={28} className="text-red-600" strokeWidth={2} />
                    ) : reward.isPending ? (
                      <Clock
                        size={28}
                        className="text-yellow-600"
                        strokeWidth={1.5}
                      />
                    ) : reward.canExchange ? (
                      <CheckCircle2
                        size={28}
                        className="text-primary"
                        strokeWidth={1.5}
                      />
                    ) : (
                      <Gift
                        size={28}
                        className="text-gray-400"
                        strokeWidth={1.5}
                      />
                    )}
                  </div>

                  {/* 特典情報 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-primary">
                        {reward.nextMilestone}
                      </span>
                      <span className="text-sm text-gray-500">個目</span>
                    </div>
                    <h3 className="mt-1 text-lg font-semibold text-gray-800">
                      {reward.name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {(() => {
                        // POIC特典の場合、初回/2回目の説明を切り替え
                        if (reward.is_first_time_special && reward.reward_type === 'poic') {
                          // 50個目のマイルストーンでPOICを受け取ったことがあるか確認
                          // （50個目が初回、100個目以降は2回目扱い）
                          const hasReceivedPoicAt50 = exchangeHistory.some(
                            h => h.reward_id === reward.id &&
                                 h.is_milestone_based === true &&
                                 h.milestone_reached === 50
                          );
                          return hasReceivedPoicAt50
                            ? (reward.subsequent_description || reward.description)
                            : (reward.first_time_description || reward.description);
                        }
                        return reward.description;
                      })()}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {/* 期限切れバッジ */}
                      {reward.isExpired && reward.validUntil && (
                        <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
                          ⚠️ 有効期限切れ（{formatValidUntil(reward.validUntil)}）
                        </span>
                      )}

                      {/* 有効期限表示（期限切れでない場合のみ） */}
                      {!reward.isExpired && reward.isPending && reward.validUntil && (
                        <>
                          {reward.daysRemaining !== null && reward.daysRemaining === 0 && (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                              ⚠️ 今日まで有効
                            </span>
                          )}
                          {reward.daysRemaining !== null && reward.daysRemaining === 1 && (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                              明日まで有効
                            </span>
                          )}
                          {reward.daysRemaining !== null && reward.daysRemaining > 1 && (
                            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
                              あと{reward.daysRemaining}日有効
                            </span>
                          )}
                        </>
                      )}

                      {/* マイルストーン型の有効期限説明（申請前） */}
                      {!reward.isPending && !reward.isCompleted && !reward.isCancelled && reward.validity_months !== null && (
                        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
                          {reward.validity_months === 0 ? "当日限り" : `有効期限: ${reward.validity_months}ヶ月`}
                        </span>
                      )}

                      {!reward.canExchange && (
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                          あと{reward.nextMilestone - fullStamps}個
                        </span>
                      )}
                      {reward.canExchange && !reward.isPending && !reward.isCompleted && !reward.isCancelled && !reward.isExpired && (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                          交換可能！
                        </span>
                      )}
                    </div>

                    {/* 歯ブラシ当日限り警告 */}
                    {!reward.isExpired && reward.isPending && reward.reward_type === 'toothbrush' && reward.daysRemaining !== null && reward.daysRemaining === 0 && (
                      <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                        <p className="text-xs text-amber-800 font-medium">
                          ⚠️ この特典は今日限り有効です！お早めにお受け取りください。
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 交換ボタン */}
                <div className="mt-4">
                  {reward.isExpired ? (
                    <button
                      disabled
                      className="w-full cursor-not-allowed rounded-lg bg-gray-200 px-4 py-3 text-sm font-medium text-gray-600"
                    >
                      有効期限切れ
                    </button>
                  ) : reward.isCompleted ? (
                    <button
                      disabled
                      className="w-full cursor-not-allowed rounded-lg bg-green-100 px-4 py-3 text-sm font-medium text-green-700"
                    >
                      交換完了
                    </button>
                  ) : reward.isCancelled ? (
                    <button
                      disabled
                      className="w-full cursor-not-allowed rounded-lg bg-red-100 px-4 py-3 text-sm font-medium text-red-700"
                    >
                      キャンセル済み
                    </button>
                  ) : reward.isPending ? (
                    <button
                      disabled
                      className="w-full cursor-not-allowed rounded-lg bg-yellow-100 px-4 py-3 text-sm font-medium text-yellow-700"
                    >
                      受付で確認中...
                    </button>
                  ) : reward.canExchange ? (
                    <button
                      onClick={() => handleExchange(reward.id, reward.name, reward.nextMilestone)}
                      disabled={isExchanging}
                      className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isExchanging ? "交換中..." : "この特典と交換する"}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full cursor-not-allowed rounded-lg bg-gray-100 px-4 py-3 text-sm font-medium text-gray-400"
                    >
                      スタンプが不足しています
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
