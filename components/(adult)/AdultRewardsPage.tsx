"use client";

import { useEffect, useState } from "react";
import { useLiff } from "@/hooks/useLiff";
import { Gift, CheckCircle2, Clock, Check, X } from "lucide-react";
import {
  fetchRewards,
  exchangeReward,
  addRewardStatus,
  fetchUserExchangeHistory,
} from "@/lib/rewards";
import { fetchStampCount, calculateStampDisplay } from "@/lib/stamps";
import { RewardWithStatus, RewardExchange } from "@/types/reward";
import { supabase } from "@/lib/supabase";

export default function AdultRewardsPage() {
  const { isInitialized, isLoggedIn, isLoading, profile, login } = useLiff();
  const [rewards, setRewards] = useState<RewardWithStatus[]>([]);
  const [stampCount, setStampCount] = useState(0);
  const [familyStampCount, setFamilyStampCount] = useState<number | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [exchangeHistory, setExchangeHistory] = useState<RewardExchange[]>([]);
  const [isLoadingRewards, setIsLoadingRewards] = useState(true);
  const [isExchanging, setIsExchanging] = useState(false);

  // 特典交換に使用するスタンプ数（家族がいる場合は家族合算、いない場合は個人）
  const effectiveStampCount = familyId && familyStampCount !== null ? familyStampCount : stampCount;

  // 10倍整数システム対応のスタンプ表示
  const { fullStamps, progress } = calculateStampDisplay(effectiveStampCount);

  // 特典一覧とスタンプ数、交換履歴を取得
  useEffect(() => {
    const loadData = async () => {
      if (!isLoggedIn || !profile?.userId) return;

      setIsLoadingRewards(true);
      try {
        // 並行して取得
        const [rewardsData, count, history, profileData] = await Promise.all([
          fetchRewards(),
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

        // 家族IDを取得
        const userFamilyId = profileData.data?.family_id || null;
        setFamilyId(userFamilyId);

        // 家族に所属している場合、家族全体のスタンプ数を取得
        if (userFamilyId) {
          const { data: familyData } = await supabase
            .from("family_stamp_totals")
            .select("total_stamp_count")
            .eq("family_id", userFamilyId)
            .single();

          if (familyData) {
            setFamilyStampCount(familyData.total_stamp_count ?? 0);
            // 家族合算値でステータスを設定
            setRewards(addRewardStatus(rewardsData, familyData.total_stamp_count ?? 0, history));
          } else {
            setFamilyStampCount(null);
            setRewards(addRewardStatus(rewardsData, count, history));
          }
        } else {
          // 家族なし：個人のスタンプ数を使用
          setFamilyStampCount(null);
          setRewards(addRewardStatus(rewardsData, count, history));
        }
      } catch (error) {
        console.error("❌ データ取得エラー:", error);
      } finally {
        setIsLoadingRewards(false);
      }
    };

    loadData();
  }, [isLoggedIn, profile]);

  // 特典交換処理
  const handleExchange = async (rewardId: string, rewardName: string) => {
    if (!profile?.userId) return;

    const confirmed = window.confirm(
      `「${rewardName}」と交換しますか？\n\n✨ スタンプは交換後も減りません\n\n受付でお受け取りください。`
    );

    if (!confirmed) return;

    setIsExchanging(true);
    try {
      const result = await exchangeReward(profile.userId, rewardId);

      if (result.success) {
        alert(result.message);

        // 交換履歴を再取得して状態を更新
        const [newHistory, newCount] = await Promise.all([
          fetchUserExchangeHistory(profile.userId),
          fetchStampCount(profile.userId),
        ]);

        setExchangeHistory(newHistory);
        setStampCount(newCount);

        // 家族がいる場合は家族スタンプ数も再取得
        if (familyId) {
          const { data: familyData } = await supabase
            .from("family_stamp_totals")
            .select("total_stamp_count")
            .eq("family_id", familyId)
            .single();

          if (familyData) {
            setFamilyStampCount(familyData.total_stamp_count ?? 0);
            setRewards((prev) => addRewardStatus(prev, familyData.total_stamp_count ?? 0, newHistory));
          } else {
            setRewards((prev) => addRewardStatus(prev, newCount, newHistory));
          }
        } else {
          setRewards((prev) => addRewardStatus(prev, newCount, newHistory));
        }
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
        <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-gray-400">
          交換できる特典
        </h2>

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
                key={reward.id}
                className={`rounded-xl border bg-white p-5 shadow-sm transition-all ${
                  reward.isCompleted
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
                      reward.isCompleted
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
                    {reward.isCompleted ? (
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
                    <h3 className="text-lg font-semibold text-gray-800">
                      {reward.name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {reward.description}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          reward.isCompleted
                            ? "bg-green-100 text-green-700"
                            : reward.isCancelled
                            ? "bg-red-100 text-red-700"
                            : reward.isPending
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {reward.required_stamps}個で交換
                      </span>
                      {!reward.canExchange &&
                        !reward.isPending &&
                        !reward.isCompleted &&
                        !reward.isCancelled && (
                          <span className="text-xs text-gray-500">
                            あと{reward.remainingStamps}個
                          </span>
                        )}
                    </div>
                  </div>
                </div>

                {/* 交換ボタン */}
                <div className="mt-4">
                  {reward.isCompleted ? (
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
                      onClick={() => handleExchange(reward.id, reward.name)}
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
