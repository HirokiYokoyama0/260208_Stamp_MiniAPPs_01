import { Reward, RewardWithStatus, RewardExchange } from "@/types/reward";
import { supabase } from "@/lib/supabase";

/**
 * 特典一覧を取得
 */
export const fetchRewards = async (): Promise<Reward[]> => {
  try {
    const response = await fetch("/api/rewards");
    const data = await response.json();

    if (!data.success) {
      console.error("❌ 特典一覧取得エラー:", data.error);
      return [];
    }

    return data.rewards;
  } catch (error) {
    console.error("❌ 特典一覧取得エラー:", error);
    return [];
  }
};

/**
 * ユーザーの特典交換履歴を取得
 */
export const fetchUserExchangeHistory = async (
  userId: string
): Promise<RewardExchange[]> => {
  try {
    const { data, error } = await supabase
      .from("reward_exchanges")
      .select("*")
      .eq("user_id", userId)
      .order("exchanged_at", { ascending: false });

    if (error) {
      console.error("❌ 交換履歴取得エラー:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("❌ 交換履歴取得エラー:", error);
    return [];
  }
};

/**
 * 特典を交換
 */
export const exchangeReward = async (
  userId: string,
  rewardId: string
): Promise<{
  success: boolean;
  message: string;
  newStampCount?: number;
}> => {
  try {
    const response = await fetch("/api/rewards/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, rewardId }),
    });

    const data = await response.json();
    return {
      success: data.success,
      message: data.message,
      newStampCount: data.newStampCount,
    };
  } catch (error) {
    console.error("❌ 特典交換エラー:", error);
    return {
      success: false,
      message: "エラーが発生しました",
    };
  }
};

/**
 * 特典に交換可否の情報を付与（pending/completed/cancelled チェック込み）
 */
export const addRewardStatus = (
  rewards: Reward[],
  currentStampCount: number,
  exchangeHistory: RewardExchange[]
): RewardWithStatus[] => {
  return rewards.map((reward) => {
    // この特典の最新の交換履歴を取得
    const latestExchange = exchangeHistory
      .filter((ex) => ex.reward_id === reward.id)
      .sort(
        (a, b) =>
          new Date(b.exchanged_at).getTime() -
          new Date(a.exchanged_at).getTime()
      )[0] || null;

    // ステータスチェック
    const isPending = latestExchange?.status === "pending";
    const isCompleted = latestExchange?.status === "completed";
    const isCancelled = latestExchange?.status === "cancelled";

    // スタンプ数チェック（pending の場合は交換不可）
    const canExchange =
      currentStampCount >= reward.required_stamps && !isPending;
    const remainingStamps = Math.max(
      0,
      reward.required_stamps - currentStampCount
    );

    return {
      ...reward,
      canExchange,
      remainingStamps,
      isPending,
      isCompleted,
      isCancelled,
      latestExchange,
    };
  });
};
