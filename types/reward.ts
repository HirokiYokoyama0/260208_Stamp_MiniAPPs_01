/**
 * 特典マスターのレコード
 */
export interface Reward {
  id: string;
  name: string;
  description: string | null;
  required_stamps: number;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * 特典交換履歴のレコード
 */
export interface RewardExchange {
  id: string;
  user_id: string;
  reward_id: string;
  stamp_count_used: number;
  exchanged_at: string;
  status: "pending" | "completed" | "cancelled";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 特典交換APIのリクエスト
 */
export interface ExchangeRewardRequest {
  userId: string;
  rewardId: string;
}

/**
 * 特典交換APIのレスポンス
 */
export interface ExchangeRewardResponse {
  success: boolean;
  message: string;
  exchange?: RewardExchange;
  newStampCount?: number;
  error?: string;
}

/**
 * 特典一覧取得APIのレスポンス
 */
export interface GetRewardsResponse {
  success: boolean;
  rewards: Reward[];
  error?: string;
}

/**
 * 表示用の特典情報（ユーザーのスタンプ数との比較含む）
 */
export interface RewardWithStatus extends Reward {
  canExchange: boolean; // 交換可能かどうか
  remainingStamps: number; // あと何個必要か（マイナスなら交換可能）
}
