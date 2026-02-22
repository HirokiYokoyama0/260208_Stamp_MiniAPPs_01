/**
 * ユーザープロフィール型定義
 *
 * Supabase の profiles テーブルの型定義
 */

export interface UserProfile {
  id: string; // LINE User ID (主キー)
  line_user_id: string; // LINE User ID
  display_name: string; // LINE表示名
  picture_url?: string | null; // LINEプロフィール画像URL

  // スタンプ関連
  stamp_count: number; // 累積ポイント（内部単位: 10点 = スタンプ1個）
  visit_count: number; // 純粋な来院回数
  last_visit_date?: string | null; // 最終来院日時

  // 患者情報
  ticket_number?: string | null; // 診察券番号
  real_name?: string | null; // 本名（漢字）

  // 家族機能
  family_id?: string | null; // 所属する家族のID
  family_role?: 'parent' | 'child' | null; // 家族内の役割

  // その他
  is_line_friend?: boolean | null; // 公式LINE友だち登録状態
  view_mode: 'adult' | 'kids'; // 表示モード
  next_visit_date?: string | null; // 次回来院予定日
  next_memo?: string | null; // ユーザーへの次回メモ
  next_memo_updated_at?: string | null; // 次回メモの最終更新日時
  reservation_button_clicks: number; // 予約ボタンのクリック回数

  // タイムスタンプ
  created_at: string;
  updated_at: string;
}

/**
 * プロフィール更新用の型（一部のフィールドのみ）
 */
export interface ProfileUpdate {
  display_name?: string;
  picture_url?: string | null;
  ticket_number?: string | null;
  real_name?: string | null;
  view_mode?: 'adult' | 'kids';
  family_id?: string | null;
  family_role?: 'parent' | 'child' | null;
}