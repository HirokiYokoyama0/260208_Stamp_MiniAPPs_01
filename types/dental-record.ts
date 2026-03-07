/**
 * ケア記録機能の型定義
 * 参考: Doc_miniApps/54_ケア記録機能_LIFF開発者向け.md
 * 参考: supabase/019_create_dental_records_table.sql
 */

/**
 * 歯の治療状態（2026-03-07更新: 8種類に整理）
 */
export type ToothStatus =
  | 'cavity_completed'     // 虫歯治療済み
  | 'observation'          // 経過観察
  | 'cavity_planned'       // 治療予定
  | 'in_treatment'         // 治療中 ★NEW
  | 'crown'                // 被せ物
  | 'scaling_completed'    // 歯石除去
  | 'cleaning';            // クリーニング

/**
 * 歯の状態データ（tooth_data JSONB の1歯分）
 */
export type ToothData = {
  status: ToothStatus;
  status_label: string;    // 日本語ラベル（例: "虫歯治療"）
  color: string;           // 表示色（例: "#10b981"）
  updated_at: string;      // ISO 8601形式
};

/**
 * ケア記録（patient_dental_records テーブル）
 */
export type DentalRecord = {
  id: string;                                      // UUID
  patient_id: string;                              // LINE User ID
  tooth_data: { [toothNumber: string]: ToothData }; // JSONB
  staff_memo?: string | null;                      // スタッフ用内部メモ（患者には非表示）
  next_visit_memo?: string | null;                 // 次回予定メモ（患者にも表示）
  recorded_at: string;                             // ISO 8601形式
  staff_display_name?: string;                     // スタッフ名（RPC関数で取得）
  created_at?: string;
  updated_at?: string;
};

/**
 * 治療履歴の変更箇所（タイムライン表示用）
 */
export type HistoryChange = {
  tooth_number: string;    // 歯番号（例: "16"）
  tooth_name: string;      // 歯の名称（例: "右上第一大臼歯"）
  status_label: string;    // 治療内容（例: "虫歯治療"）
};

/**
 * 治療履歴レコード（タイムライン表示用）
 */
export type HistoryRecord = {
  id: string;
  recorded_at: string;
  staff_display_name: string;
  next_visit_memo: string | null;
  changes: HistoryChange[];  // 加工済みの変更箇所リスト
};

/**
 * 歯番号の型（ISO 3950）
 */
export type PermanentToothNumber =
  | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18' // 上顎左
  | '21' | '22' | '23' | '24' | '25' | '26' | '27' | '28' // 上顎右
  | '31' | '32' | '33' | '34' | '35' | '36' | '37' | '38' // 下顎左
  | '41' | '42' | '43' | '44' | '45' | '46' | '47' | '48'; // 下顎右

export type BabyToothNumber =
  | '51' | '52' | '53' | '54' | '55' // 上顎右
  | '61' | '62' | '63' | '64' | '65' // 上顎左
  | '71' | '72' | '73' | '74' | '75' // 下顎左
  | '81' | '82' | '83' | '84' | '85'; // 下顎右

export type ToothNumber = PermanentToothNumber | BabyToothNumber;

/**
 * 歯の部位（5分割）
 */
export type ToothPart = 'buccal' | 'distal' | 'lingual' | 'mesial' | 'occlusal';

/**
 * 歯の状態色マッピング（2026-03-07更新）
 * 医療UIカラールール:
 * 🟢 緑系: 完了・良好
 * 🟡 黄系: 経過観察
 * 🟠 オレンジ系: 治療中
 * 🔴 赤系: 要治療
 * 🔵 青系: 処置済み
 * 🩵 水色系: メンテナンス済み
 * 🟣 紫系: 予防ケア
 */
export const TOOTH_STATUS_COLORS: Record<ToothStatus, string> = {
  cavity_completed: '#10b981',  // 🟢 緑 - 虫歯治療済
  observation: '#eab308',       // 🟡 黄 - 経過観察（色変更）
  cavity_planned: '#dc2626',    // 🔴 赤 - 治療予定（色変更）
  in_treatment: '#f97316',      // 🟠 オレンジ - 治療中 ★NEW
  crown: '#3b82f6',             // 🔵 青 - 被せ物
  scaling_completed: '#06b6d4', // 🩵 水色 - 歯石除去（色変更）
  cleaning: '#a855f7',          // 🟣 紫 - クリーニング（色変更）
};

/**
 * デフォルト色（記録なし）
 */
export const DEFAULT_TOOTH_COLOR = '#ffffff'; // ⚪ 白
