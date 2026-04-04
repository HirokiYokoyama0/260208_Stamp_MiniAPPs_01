/**
 * 特典マスターのレコード（旧仕様 - 手動交換型）
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
 * マイルストーン型特典マスターのレコード（新仕様）
 */
export interface MilestoneReward {
  id: string;
  name: string;
  description: string | null;
  milestone_type: 'every_10' | 'every_50' | 'every_150_from_300';
  is_first_time_special: boolean;
  first_time_description: string | null;
  subsequent_description: string | null;
  validity_months: number | null; // 0 = 当日限り, NULL = 無期限, n = n ヶ月
  reward_type: 'toothbrush' | 'poic' | 'premium_menu';
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
  status: "available" | "pending" | "completed" | "cancelled" | "expired";
  notes: string | null;
  created_at: string;
  updated_at: string;

  // 新仕様で追加されたカラム
  milestone_reached?: number | null;
  valid_until?: string | null;
  is_first_time?: boolean | null;
  is_milestone_based?: boolean | null;
}

/**
 * 特典交換APIのリクエスト
 */
export interface ExchangeRewardRequest {
  userId: string;
  rewardId: string;
  milestone?: number; // どのマイルストーンで交換したか（10, 20, 50など）
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
  rewards: Reward[] | MilestoneReward[];
  error?: string;
}

/**
 * 表示用の特典情報（ユーザーのスタンプ数との比較含む）
 */
export interface RewardWithStatus extends Reward {
  canExchange: boolean; // 交換可能かどうか
  remainingStamps: number; // あと何個必要か（マイナスなら交換可能）
  isPending: boolean; // 申請中（pending）かどうか
  isCompleted: boolean; // 交換完了（completed）かどうか
  isCancelled: boolean; // キャンセル（cancelled）かどうか
  latestExchange: RewardExchange | null; // 最新の交換履歴
}
