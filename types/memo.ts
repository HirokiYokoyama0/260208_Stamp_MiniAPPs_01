/**
 * 次回メモの型定義
 */

/**
 * ユーザーの次回メモ情報
 */
export interface UserMemo {
  next_visit_date: string | null; // YYYY-MM-DD形式
  next_memo: string | null;
  next_memo_updated_at: string | null;
}

/**
 * 次回メモ取得APIのレスポンス
 */
export interface GetUserMemoResponse {
  success: boolean;
  memo: UserMemo | null;
  error?: string;
}

/**
 * 次回メモ更新APIのリクエスト
 */
export interface UpdateUserMemoRequest {
  userId: string;
  next_visit_date?: string | null; // YYYY-MM-DD形式
  next_memo?: string | null;
}

/**
 * 次回メモ更新APIのレスポンス
 */
export interface UpdateUserMemoResponse {
  success: boolean;
  message: string;
  memo?: UserMemo;
  error?: string;
}
