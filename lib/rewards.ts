import { Reward, RewardWithStatus } from "@/types/reward";

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
 * 特典に交換可否の情報を付与
 */
export const addRewardStatus = (
  rewards: Reward[],
  currentStampCount: number
): RewardWithStatus[] => {
  return rewards.map((reward) => {
    const canExchange = currentStampCount >= reward.required_stamps;
    const remainingStamps = reward.required_stamps - currentStampCount;

    return {
      ...reward,
      canExchange,
      remainingStamps,
    };
  });
};
