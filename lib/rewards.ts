import { Reward, MilestoneReward, RewardWithStatus, RewardExchange } from "@/types/reward";
import { supabase } from "@/lib/supabase";

/**
 * マイルストーンタイプから最小スタンプ数を取得
 */
function getMinimumStampsForMilestone(milestoneType: string): number {
  switch (milestoneType) {
    case 'every_10':
      return 10;
    case 'every_50':
      return 50;
    case 'every_150_from_300':
      return 300;
    default:
      return 10;
  }
}

/**
 * 特典一覧を取得（新仕様のマイルストーン型を旧仕様互換形式に変換）
 */
export const fetchRewards = async (): Promise<Reward[]> => {
  try {
    // 新仕様のマイルストーン型特典を取得
    const milestoneRewards = await fetchMilestoneRewards();

    // 旧仕様互換の形式に変換
    return milestoneRewards.map((mr): Reward => ({
      id: mr.id,
      name: mr.name,
      description: mr.description || '',
      required_stamps: getMinimumStampsForMilestone(mr.milestone_type),
      image_url: null,
      is_active: mr.is_active,
      display_order: mr.display_order,
      created_at: mr.created_at,
      updated_at: mr.updated_at
    }));
  } catch (error) {
    console.error("❌ 特典一覧取得エラー:", error);
    return [];
  }
};

/**
 * マイルストーン型特典一覧を取得（新仕様）
 */
export const fetchMilestoneRewards = async (): Promise<MilestoneReward[]> => {
  try {
    console.log("🔍 milestone_rewards テーブルから取得開始...");

    const { data, error } = await supabase
      .from("milestone_rewards")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("❌ マイルストーン特典一覧取得エラー:", error);
      console.error("❌ エラー詳細:", JSON.stringify(error, null, 2));
      return [];
    }

    console.log(`✅ milestone_rewards から ${data?.length || 0} 件取得しました`);
    console.log("📊 取得データ:", JSON.stringify(data, null, 2));

    return data as MilestoneReward[];
  } catch (error) {
    console.error("❌ マイルストーン特典一覧取得エラー (catch):", error);
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
  rewardId: string,
  milestone?: number
): Promise<{
  success: boolean;
  message: string;
  newStampCount?: number;
}> => {
  try {
    const response = await fetch("/api/rewards/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, rewardId, milestone }),
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
