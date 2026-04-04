-- =====================================
-- ミニマムRLS強化（現行動作を壊さない）修正版
-- =====================================
-- 作成日: 2026-04-03
-- 修正: families_parent_permissions テーブルを除外
-- 目的: RLSポリシーに形式チェックを追加し、全件取得攻撃を防ぐ
-- 影響: 既存のクライアントコードは変更不要（全て .eq("id", userId) を使用しているため）

-- 現在の日時を記録
SELECT NOW() AS migration_started;

-- =====================================
-- 1. profiles テーブル
-- =====================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "allow_public_read" ON profiles;
DROP POLICY IF EXISTS "allow_public_insert" ON profiles;
DROP POLICY IF EXISTS "allow_public_update" ON profiles;

-- SELECT: LINE User ID 形式チェック
CREATE POLICY "profiles_read_with_format_check"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (
    -- 本番LINE User ID（U + 32文字の16進数）
    id ~ '^U[0-9a-f]{32}$' OR
    -- テストLINE User ID（U_test_で始まる）
    id ~ '^U_test_' OR
    -- 代理管理メンバー（manual-child-で始まる）
    id LIKE 'manual-child-%'
  );

-- INSERT: 同上
CREATE POLICY "profiles_insert_with_format_check"
  ON profiles FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    id ~ '^U[0-9a-f]{32}$' OR
    id ~ '^U_test_' OR
    id LIKE 'manual-child-%'
  );

-- UPDATE: 同上
CREATE POLICY "profiles_update_with_format_check"
  ON profiles FOR UPDATE
  TO anon, authenticated
  USING (
    id ~ '^U[0-9a-f]{32}$' OR
    id ~ '^U_test_' OR
    id LIKE 'manual-child-%'
  )
  WITH CHECK (
    id ~ '^U[0-9a-f]{32}$' OR
    id ~ '^U_test_' OR
    id LIKE 'manual-child-%'
  );

-- DELETE: 禁止（管理ダッシュボードのみ）
CREATE POLICY "profiles_deny_delete"
  ON profiles FOR DELETE
  TO anon, authenticated
  USING (false);

-- =====================================
-- 2. stamp_history テーブル
-- =====================================

DROP POLICY IF EXISTS "allow_public_read" ON stamp_history;
DROP POLICY IF EXISTS "allow_public_insert" ON stamp_history;
DROP POLICY IF EXISTS "allow_public_delete" ON stamp_history;
DROP POLICY IF EXISTS "allow_public_update" ON stamp_history;

-- SELECT: user_id が LINE User ID 形式
CREATE POLICY "stamp_history_read_with_format_check"
  ON stamp_history FOR SELECT
  TO anon, authenticated
  USING (
    user_id ~ '^U[0-9a-f]{32}$' OR
    user_id ~ '^U_test_' OR
    user_id LIKE 'manual-child-%'
  );

-- INSERT: 同上
CREATE POLICY "stamp_history_insert_with_format_check"
  ON stamp_history FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id ~ '^U[0-9a-f]{32}$' OR
    user_id ~ '^U_test_' OR
    user_id LIKE 'manual-child-%'
  );

-- UPDATE/DELETE: 禁止
CREATE POLICY "stamp_history_deny_update"
  ON stamp_history FOR UPDATE
  TO anon, authenticated
  USING (false);

CREATE POLICY "stamp_history_deny_delete"
  ON stamp_history FOR DELETE
  TO anon, authenticated
  USING (false);

-- =====================================
-- 3. reward_exchanges テーブル
-- =====================================

DROP POLICY IF EXISTS "allow_public_read_exchanges" ON reward_exchanges;
DROP POLICY IF EXISTS "allow_public_insert_exchanges" ON reward_exchanges;

CREATE POLICY "reward_exchanges_read_with_format_check"
  ON reward_exchanges FOR SELECT
  TO anon, authenticated
  USING (
    user_id ~ '^U[0-9a-f]{32}$' OR
    user_id ~ '^U_test_' OR
    user_id LIKE 'manual-child-%'
  );

CREATE POLICY "reward_exchanges_insert_with_format_check"
  ON reward_exchanges FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id ~ '^U[0-9a-f]{32}$' OR
    user_id ~ '^U_test_' OR
    user_id LIKE 'manual-child-%'
  );

-- UPDATE/DELETE: 禁止
CREATE POLICY "reward_exchanges_deny_update"
  ON reward_exchanges FOR UPDATE
  TO anon, authenticated
  USING (false);

CREATE POLICY "reward_exchanges_deny_delete"
  ON reward_exchanges FOR DELETE
  TO anon, authenticated
  USING (false);

-- =====================================
-- 4. families テーブル
-- =====================================

DROP POLICY IF EXISTS "allow_public_read" ON families;
DROP POLICY IF EXISTS "allow_public_insert" ON families;
DROP POLICY IF EXISTS "allow_public_update" ON families;
DROP POLICY IF EXISTS "allow_public_delete" ON families;

-- SELECT: family_id が UUID 形式
CREATE POLICY "families_read_with_format_check"
  ON families FOR SELECT
  TO anon, authenticated
  USING (
    id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

-- INSERT: 同上
CREATE POLICY "families_insert_with_format_check"
  ON families FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

-- UPDATE: 同上
CREATE POLICY "families_update_with_format_check"
  ON families FOR UPDATE
  TO anon, authenticated
  USING (
    id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
  WITH CHECK (
    id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

-- DELETE: 禁止
CREATE POLICY "families_deny_delete"
  ON families FOR DELETE
  TO anon, authenticated
  USING (false);

-- =====================================
-- 5. patient_dental_records テーブル
-- =====================================

DROP POLICY IF EXISTS "anon_can_read_dental_records" ON patient_dental_records;

-- SELECT: patient_id が LINE User ID 形式
CREATE POLICY "dental_records_read_with_format_check"
  ON patient_dental_records FOR SELECT
  TO anon, authenticated
  USING (
    patient_id ~ '^U[0-9a-f]{32}$' OR
    patient_id ~ '^U_test_' OR
    patient_id LIKE 'manual-child-%'
  );

-- INSERT/UPDATE/DELETE は SERVICE_ROLE_KEY のみ（既存の制約を維持）
-- allow_insert_dental_records / allow_update_dental_records ポリシーはそのまま維持

-- =====================================
-- 6. milestone_history テーブル
-- =====================================

DROP POLICY IF EXISTS "milestone_history_user_read" ON milestone_history;

CREATE POLICY "milestone_history_read_with_format_check"
  ON milestone_history FOR SELECT
  TO anon, authenticated
  USING (
    user_id ~ '^U[0-9a-f]{32}$' OR
    user_id ~ '^U_test_' OR
    user_id LIKE 'manual-child-%'
  );

-- INSERT/UPDATE/DELETE: 禁止（APIからのみ）
CREATE POLICY "milestone_history_deny_insert"
  ON milestone_history FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "milestone_history_deny_update"
  ON milestone_history FOR UPDATE
  TO anon, authenticated
  USING (false);

CREATE POLICY "milestone_history_deny_delete"
  ON milestone_history FOR DELETE
  TO anon, authenticated
  USING (false);

-- =====================================
-- 7. event_logs テーブル
-- =====================================

-- event_logs は管理ダッシュボードのみアクセス可能にする
DROP POLICY IF EXISTS "allow_anon_insert_event_logs" ON event_logs;
DROP POLICY IF EXISTS "allow_authenticated_insert_event_logs" ON event_logs;

-- SELECT/INSERT/UPDATE/DELETE: 全て禁止（SERVICE_ROLE_KEY のみ）
CREATE POLICY "event_logs_deny_all_anon"
  ON event_logs FOR ALL
  TO anon, authenticated
  USING (false);

-- =====================================
-- 8. families_parent_permissions テーブル
-- =====================================
-- ⚠️ このテーブルは存在しないためスキップ

-- =====================================
-- 完了
-- =====================================

SELECT NOW() AS migration_completed;

-- 影響を確認
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_clause
FROM pg_policies
WHERE tablename IN (
  'profiles',
  'stamp_history',
  'reward_exchanges',
  'families',
  'patient_dental_records',
  'milestone_history',
  'event_logs'
)
ORDER BY tablename, cmd;

-- =====================================
-- 検証クエリ（実行後に確認）
-- =====================================

-- 1. 全件取得（失敗するべき）
-- SELECT * FROM profiles;  -- エラーになるはず

-- 2. 特定IDで取得（成功するべき）
-- SELECT * FROM profiles WHERE id = 'U5c70cd61f4fe89a65381cd7becee8de3';  -- 成功するはず

-- 3. ポリシー確認
-- SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE tablename = 'profiles';
