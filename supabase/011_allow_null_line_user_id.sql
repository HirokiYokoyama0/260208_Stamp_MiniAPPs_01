-- ========================================
-- マイグレーション: line_user_id の NULL 許可
-- ファイル: 011_allow_null_line_user_id.sql
-- 作成日: 2026-02-18
-- ========================================
--
-- 【目的】
-- 代理管理メンバー（スマホなし子供）をサポートするため、
-- line_user_id カラムの NOT NULL 制約を削除し、NULL を許可する
--
-- 【変更内容】
-- 1. line_user_id の NOT NULL 制約を削除
-- 2. UNIQUE 制約は維持（NULL は複数存在可能）
--
-- ========================================

-- NOT NULL 制約を削除
ALTER TABLE profiles
  ALTER COLUMN line_user_id DROP NOT NULL;

-- コメント更新
COMMENT ON COLUMN profiles.line_user_id IS 'LINEユーザーID（代理管理メンバーの場合はNULL）';

-- ========================================
-- マイグレーション完了
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ line_user_id の NULL 許可が完了しました';
  RAISE NOTICE '📝 代理管理メンバー（スマホなし子供）の作成が可能になりました';
END $$;
