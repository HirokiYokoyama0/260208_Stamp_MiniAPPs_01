-- ========================================
-- マイグレーション: 15個スタンプ対応（visit_count修正）
-- ファイル: 021_fix_visit_count_for_15_stamps.sql
-- 作成日: 2026-03-26
-- ========================================
--
-- 【問題】
-- 008のマイグレーションで作成したトリガーが amount = 10 のみをカウントしている
-- 新しい仕様：
--   - Premium: amount = 15
--   - Regular: amount = 10
--   - Purchase: amount = 5
--
-- visit_count は「来院回数」をカウントするため、
-- amount = 10 または amount = 15 をカウントする必要がある
-- （purchase_incentive は来院ではないのでカウント対象外）
--
-- ========================================

-- トリガー関数を更新
CREATE OR REPLACE FUNCTION update_profile_stamp_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET
    -- 累積スタンプ数 = MAX(stamp_number)
    stamp_count = (
      SELECT COALESCE(MAX(stamp_number), 0)
      FROM stamp_history
      WHERE user_id = NEW.user_id
    ),
    -- 来院回数 = stamp_method が 'qr' または 'qr_scan' のレコード数
    -- （来院QRのみカウント、purchase_incentive は除外）
    visit_count = (
      SELECT COUNT(*)
      FROM stamp_history
      WHERE user_id = NEW.user_id
        AND stamp_method IN ('qr', 'qr_scan')
    ),
    -- 最終来院日 = MAX(visit_date)
    last_visit_date = (
      SELECT MAX(visit_date)
      FROM stamp_history
      WHERE user_id = NEW.user_id
    ),
    updated_at = NOW()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 既存データの visit_count を再計算
-- ========================================

UPDATE profiles p
SET visit_count = (
  SELECT COUNT(*)
  FROM stamp_history
  WHERE user_id = p.id
    AND stamp_method IN ('qr', 'qr_scan')
);

-- ========================================
-- マイグレーション完了
-- ========================================
--
-- 【確認SQL】
-- -- visit_count の確認
-- SELECT id, display_name, stamp_count, visit_count
-- FROM profiles
-- WHERE stamp_count > 0
-- ORDER BY stamp_count DESC;
--
-- -- 各 stamp_method のカウント確認
-- SELECT stamp_method, COUNT(*) as count, SUM(amount) as total_amount
-- FROM stamp_history
-- GROUP BY stamp_method
-- ORDER BY count DESC;
--
