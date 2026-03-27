-- ========================================
-- validity_months の値を更新
-- ファイル: 022_update_validity_months.sql
-- 作成日: 2026-03-27
-- 目的: 既存のマイルストーン特典の有効期限を修正
-- ========================================

-- 実行前の確認
-- SELECT name, validity_months FROM milestone_rewards ORDER BY display_order;

-- ========================================
-- 有効期限の更新
-- ========================================

-- 歯ブラシ: NULL → 0（当日限り）
UPDATE milestone_rewards
SET validity_months = 0
WHERE reward_type = 'toothbrush';

-- POIC殺菌剤: NULL → 5（5ヶ月間）
UPDATE milestone_rewards
SET validity_months = 5
WHERE reward_type = 'poic';

-- 自費メニュー: 6 → 5（5ヶ月間）
UPDATE milestone_rewards
SET validity_months = 5
WHERE reward_type = 'premium_menu';

-- ========================================
-- 実行後の確認
-- ========================================

SELECT
  name,
  reward_type,
  validity_months,
  CASE
    WHEN validity_months = 0 THEN '当日限り'
    WHEN validity_months IS NULL THEN '無期限'
    ELSE validity_months || 'ヶ月'
  END AS validity_description
FROM milestone_rewards
ORDER BY display_order;

-- ========================================
-- ロールバック用SQL（必要に応じて）
-- ========================================

-- -- 元に戻す場合
-- UPDATE milestone_rewards SET validity_months = NULL WHERE reward_type = 'toothbrush';
-- UPDATE milestone_rewards SET validity_months = NULL WHERE reward_type = 'poic';
-- UPDATE milestone_rewards SET validity_months = 6 WHERE reward_type = 'premium_menu';

-- ========================================
-- 更新完了
-- ========================================
