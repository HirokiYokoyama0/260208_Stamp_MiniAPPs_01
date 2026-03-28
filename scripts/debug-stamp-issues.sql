-- ========================================
-- デバッグ用SQL: スタンプ付与の問題調査
-- ========================================
-- iPhone での報告事象:
-- 1. 15スタンプQRが10ポイントしか付与されない
-- 2. 購買インセンティブQRが1度しかスキャンできない
-- ========================================

-- ① 最近のスタンプ履歴を確認（amount と stamp_method を確認）
SELECT
  sh.id,
  p.display_name,
  sh.visit_date,
  sh.stamp_number,
  sh.amount,
  sh.stamp_method,
  sh.qr_code_id,
  sh.notes
FROM stamp_history sh
JOIN profiles p ON sh.user_id = p.id
ORDER BY sh.visit_date DESC
LIMIT 50;

-- ② Premium QR（15スタンプ）のレコードを確認
SELECT
  p.display_name,
  sh.visit_date,
  sh.stamp_number,
  sh.amount,
  sh.stamp_method,
  sh.qr_code_id
FROM stamp_history sh
JOIN profiles p ON sh.user_id = p.id
WHERE sh.notes LIKE '%premium%'
   OR sh.qr_code_id LIKE '%premium%'
ORDER BY sh.visit_date DESC;

-- ③ 購買インセンティブのレコードを確認
SELECT
  p.display_name,
  sh.visit_date,
  sh.stamp_number,
  sh.amount,
  sh.stamp_method,
  sh.qr_code_id,
  sh.notes
FROM stamp_history sh
JOIN profiles p ON sh.user_id = p.id
WHERE sh.stamp_method = 'purchase_incentive'
ORDER BY sh.visit_date DESC;

-- ④ 同じユーザーが同じ日に購買インセンティブを複数回スキャンしているか確認
SELECT
  p.display_name,
  DATE(sh.visit_date AT TIME ZONE 'Asia/Tokyo') as visit_day,
  COUNT(*) as scan_count,
  STRING_AGG(sh.amount::text, ', ') as amounts
FROM stamp_history sh
JOIN profiles p ON sh.user_id = p.id
WHERE sh.stamp_method = 'purchase_incentive'
GROUP BY p.display_name, visit_day
HAVING COUNT(*) > 1
ORDER BY visit_day DESC;

-- ⑤ 各 stamp_method の使用状況（amount 別）
SELECT
  stamp_method,
  amount,
  COUNT(*) as count
FROM stamp_history
GROUP BY stamp_method, amount
ORDER BY stamp_method, amount;

-- ⑥ amount カラムの存在確認
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'stamp_history'
  AND column_name = 'amount';

-- ⑦ 特定ユーザーの詳細履歴（テスト用 - ユーザーIDを指定して実行）
-- SELECT
--   sh.visit_date,
--   sh.stamp_number,
--   sh.amount,
--   sh.stamp_method,
--   sh.qr_code_id,
--   sh.notes
-- FROM stamp_history sh
-- WHERE sh.user_id = 'USER_ID_HERE'
-- ORDER BY sh.visit_date DESC;
