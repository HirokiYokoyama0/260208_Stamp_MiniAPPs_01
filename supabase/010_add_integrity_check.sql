-- ========================================
-- マイグレーション: 代理管理メンバーの整合性チェック追加
-- ファイル: 010_add_integrity_check.sql
-- 作成日: 2026-02-17
-- ========================================
--
-- 【目的】
-- line_user_id = NULL だけでの判断を安全にするため、
-- ID命名規則との整合性をデータベースレベルで保証する
--
-- 【変更内容】
-- 1. CHECK制約追加: line_user_id と id の整合性チェック
--    - line_user_id が NULL なら、id は 'manual-' で始まる必要がある
--    - line_user_id がある（実メンバー）なら、id は 'manual-' で始まってはいけない
--
-- 【効果】
-- - 不正なデータの登録を物理的に防ぐ
-- - 代理管理メンバーと実メンバーの誤判定を防止
-- - データ整合性を保証
--
-- ========================================

-- CHECK制約を追加
ALTER TABLE profiles
ADD CONSTRAINT check_proxy_member_integrity
CHECK (
  -- 実メンバー（line_user_idあり）の場合: IDは 'manual-' で始まってはいけない
  (line_user_id IS NOT NULL AND id NOT LIKE 'manual-%') OR
  -- 代理管理メンバー（line_user_idなし）の場合: IDは 'manual-' で始まる必要がある
  (line_user_id IS NULL AND id LIKE 'manual-%')
);

-- コメント追加
COMMENT ON CONSTRAINT check_proxy_member_integrity ON profiles IS
  '代理管理メンバー（line_user_id = NULL）のIDは必ず manual- で始まり、実メンバーは逆に manual- で始まってはいけない';

-- ========================================
-- マイグレーション完了
-- ========================================
--
-- 【確認SQL】
-- -- 全プロフィールの整合性確認
-- SELECT
--   id,
--   display_name,
--   line_user_id,
--   CASE
--     WHEN line_user_id IS NULL AND id LIKE 'manual-%' THEN '✅ 代理管理メンバー（正常）'
--     WHEN line_user_id IS NOT NULL AND id NOT LIKE 'manual-%' THEN '✅ 実メンバー（正常）'
--     ELSE '❌ 不整合'
--   END AS status
-- FROM profiles;
--
-- 【不正データテスト（これらは全てエラーになる）】
-- -- ❌ line_user_idがあるのにIDが manual- で始まる（失敗するはず）
-- INSERT INTO profiles (id, line_user_id, display_name)
-- VALUES ('manual-test-001', 'U123456789', 'テストユーザー');
--
-- -- ❌ line_user_idがないのにIDが manual- で始まらない（失敗するはず）
-- INSERT INTO profiles (id, line_user_id, display_name)
-- VALUES ('U123456789', NULL, 'テストユーザー');
--
-- 【正常データテスト（これらは成功する）】
-- -- ✅ 実メンバー
-- INSERT INTO profiles (id, line_user_id, display_name)
-- VALUES ('U123456789', 'U123456789', 'テストユーザー');
--
-- -- ✅ 代理管理メンバー
-- INSERT INTO profiles (id, line_user_id, display_name)
-- VALUES ('manual-test-001', NULL, 'テスト子供');
--
