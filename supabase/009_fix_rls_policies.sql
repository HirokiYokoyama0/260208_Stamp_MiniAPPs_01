-- ========================================
-- 修正: families テーブルのRLSポリシー
-- ファイル: 009_fix_rls_policies.sql
-- 作成日: 2026-02-16
-- ========================================
--
-- 【目的】
-- auth.uid() を使用したポリシーを削除し、全公開ポリシーに変更
-- （このプロジェクトはSupabase Authを使用していないため）
--
-- ========================================

-- ① 既存のポリシーを削除
DROP POLICY IF EXISTS "allow_family_members_read_families" ON families;
DROP POLICY IF EXISTS "allow_authenticated_insert_families" ON families;
DROP POLICY IF EXISTS "allow_parent_update_families" ON families;
DROP POLICY IF EXISTS "allow_parent_delete_families" ON families;

-- ② 新しいポリシーを作成（既存のprofilesテーブルと同じ）
-- 全員が閲覧可能
CREATE POLICY "allow_public_read"
  ON families
  FOR SELECT
  USING (true);

-- 全員が挿入可能
CREATE POLICY "allow_public_insert"
  ON families
  FOR INSERT
  WITH CHECK (true);

-- 全員が更新可能
CREATE POLICY "allow_public_update"
  ON families
  FOR UPDATE
  USING (true);

-- 全員が削除可能
CREATE POLICY "allow_public_delete"
  ON families
  FOR DELETE
  USING (true);

-- ========================================
-- 修正完了
-- ========================================

-- 【確認SQL】
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'families';
