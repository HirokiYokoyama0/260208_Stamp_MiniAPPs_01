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
  stamp_method: "qr_scan" | "manual_admin" | "import" | "survey_reward" | "slot_game";
  qr_code_id: string | null;
  amount: number | null; // QRスキャンで獲得したポイント数（通常5、優良10）
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
