-- ========================================
-- スタンプ仕様変更: stamp_method に purchase_incentive を追加
-- ファイル: 020_add_purchase_incentive_stamp_method.sql
-- 作成日: 2026-03-26
-- 参照: Doc_dashboard/48_実装状況の確認結果_正しい仕様.md
--       Doc_dashboard/52_スタンプ仕様変更_影響範囲分析.md
--       Doc_dashboard/53_スタンプ仕様変更_実装計画.md
-- ========================================

-- 既存の CHECK 制約を削除
ALTER TABLE stamp_history
DROP CONSTRAINT IF EXISTS stamp_history_stamp_method_check;

-- 新しい CHECK 制約を追加（purchase_incentive を含める）
-- 注: 現在の実装では "qr" と "qr_scan" の両方が使用されている
ALTER TABLE stamp_history
ADD CONSTRAINT stamp_history_stamp_method_check
CHECK (stamp_method IN (
  'qr',                 -- 現在の QR 読み取り実装
  'qr_scan',            -- 旧 QR 読み取り実装（後方互換性のため残存）
  'manual_admin',       -- 管理者による手動付与
  'import',             -- 一括インポート
  'survey_reward',      -- アンケート報酬
  'slot_game',          -- スロットゲーム
  'purchase_incentive'  -- 購買インセンティブQR読み取り（新規追加）
));

-- 確認用コメント
COMMENT ON COLUMN stamp_history.stamp_method IS
  'スタンプ付与方法: qr（来院QR）, qr_scan（旧来院QR・互換性）, manual_admin（管理者手動）, import（一括インポート）, survey_reward（アンケート報酬）, slot_game（スロットゲーム）, purchase_incentive（購買インセンティブQR）';

-- ========================================
-- マイグレーション完了
-- ========================================

-- 【確認SQL】
-- -- CHECK 制約の確認
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'stamp_history'::regclass
--   AND conname = 'stamp_history_stamp_method_check';
--
-- -- stamp_method の使用状況確認
-- SELECT stamp_method, COUNT(*) as count
-- FROM stamp_history
-- GROUP BY stamp_method
-- ORDER BY count DESC;
