/**
 * スタンプ機能の型定義
 */

/**
 * スタンプ履歴レコード
 */
export interface StampHistoryRecord {
  id: string;
  user_id: string;
  visit_date: string;
  stamp_number: number;
  stamp_method: "qr" | "qr_scan" | "manual_admin" | "import" | "survey_reward" | "slot_game" | "purchase_incentive";
  qr_code_id: string | null;
  amount: number | null; // スタンプ獲得数（Regular: 10, Premium: 15, Purchase: 5）
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * スタンプ登録APIのレスポンス
 */
export interface AddStampResponse {
  success: boolean;
  message: string;
  stampCount?: number;
  stampNumber?: number;
  error?: string;
}

/**
 * スタンプ進捗情報
 */
export interface StampProgress {
  percentage: number;
  remaining: number;
  isComplete: boolean;
}
