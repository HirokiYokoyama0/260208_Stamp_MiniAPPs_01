-- =====================================
-- event_logs RLS修正
-- =====================================
-- 作成日: 2026-04-05
-- 目的: LIFFアプリからのイベントログ送信を再度許可
--
-- 背景:
--   026_minimal_rls_hardening.sql でセキュリティ強化した際、
--   event_logs への INSERT も禁止してしまった。
--   これにより LIFFアプリからのログ送信が停止している。
--
-- 対策:
--   - SELECT は管理ダッシュボードのみ（SERVICE_ROLE_KEY）
--   - INSERT は LIFFアプリから可能（形式チェック付き）
--   - UPDATE/DELETE は禁止
-- =====================================

-- 現在日時を記録
SELECT NOW() AS migration_031_started;

-- =====================================
-- 1. 既存のポリシーを削除
-- =====================================

DROP POLICY IF EXISTS "event_logs_deny_all_anon" ON event_logs;
DROP POLICY IF EXISTS "allow_anon_insert_event_logs" ON event_logs;
DROP POLICY IF EXISTS "allow_authenticated_insert_event_logs" ON event_logs;
DROP POLICY IF EXISTS "Users can insert their own logs" ON event_logs;
DROP POLICY IF EXISTS "Service role can view all logs" ON event_logs;
DROP POLICY IF EXISTS "Users can view their own logs" ON event_logs;

-- =====================================
-- 2. 新しいポリシーを作成
-- =====================================

-- SELECT: 管理ダッシュボードのみ（SERVICE_ROLE_KEY で RLS バイパス）
-- anon/authenticated ユーザーからの SELECT は禁止
CREATE POLICY "event_logs_deny_select_anon"
  ON event_logs FOR SELECT
  TO anon, authenticated
  USING (false);

-- INSERT: LIFFアプリから送信可能（形式チェック付き）
CREATE POLICY "event_logs_allow_insert_with_format_check"
  ON event_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- user_id が LINE User ID 形式の場合のみ許可
    user_id ~ '^U[0-9a-f]{32}$' OR
    user_id ~ '^U_test_' OR
    user_id LIKE 'manual-child-%' OR
    user_id IS NULL  -- user_id が null の場合も許可（匿名イベント）
  );

-- UPDATE: 禁止（スタンプ履歴は不変）
CREATE POLICY "event_logs_deny_update"
  ON event_logs FOR UPDATE
  TO anon, authenticated
  USING (false);

-- DELETE: 禁止（スタンプ履歴は不変）
CREATE POLICY "event_logs_deny_delete"
  ON event_logs FOR DELETE
  TO anon, authenticated
  USING (false);

-- =====================================
-- 3. コメント追加
-- =====================================

COMMENT ON POLICY "event_logs_deny_select_anon" ON event_logs IS
  'anon/authenticatedユーザーからのSELECTを禁止（管理ダッシュボードはSERVICE_ROLE_KEYでRLSバイパス）';

COMMENT ON POLICY "event_logs_allow_insert_with_format_check" ON event_logs IS
  'LIFFアプリからのINSERTを許可（LINE User ID形式チェック付き）';

COMMENT ON POLICY "event_logs_deny_update" ON event_logs IS
  'イベントログは不変のため、UPDATEを禁止';

COMMENT ON POLICY "event_logs_deny_delete" ON event_logs IS
  'イベントログは不変のため、DELETEを禁止（管理ダッシュボードはSERVICE_ROLE_KEYで削除可能）';

-- =====================================
-- 4. 動作確認用SQL（オプション）
-- =====================================

-- 現在のポリシー一覧を確認
SELECT
  policyname,
  cmd,
  roles,
  qual AS using_clause,
  with_check
FROM pg_policies
WHERE tablename = 'event_logs'
ORDER BY cmd, policyname;

-- 完了
SELECT NOW() AS migration_031_completed;

-- =====================================
-- 実行後の確認手順
-- =====================================
--
-- 1. LIFFアプリでイベントログ送信をテスト
--    - アプリを開く → app_open イベントが記録されるか確認
--    - QRスキャン → stamp_scan_success イベントが記録されるか確認
--
-- 2. 管理ダッシュボードで確認
--    - /admin/user-logs にアクセス
--    - 新しいログが表示されるか確認
--
-- 3. セキュリティテスト（ブラウザ DevTools で実行）
--    ```javascript
--    // テスト1: SELECT（失敗するべき）
--    const { data, error } = await supabase
--      .from("event_logs")
--      .select("*");
--    console.log("SELECT エラー:", error);
--    // 期待: RLSポリシーエラー ✅
--
--    // テスト2: INSERT（成功するべき）
--    const { data: data2, error: error2 } = await supabase
--      .from("event_logs")
--      .insert({
--        user_id: "自分のLINE User ID",
--        event_name: "test_event",
--        source: "manual_test",
--        metadata: { test: true }
--      });
--    console.log("INSERT 結果:", data2, error2);
--    // 期待: 成功 ✅
--
--    // テスト3: 不正な形式のuser_id（失敗するべき）
--    const { data: data3, error: error3 } = await supabase
--      .from("event_logs")
--      .insert({
--        user_id: "invalid-format-id",
--        event_name: "test_event"
--      });
--    console.log("不正形式 エラー:", error3);
--    // 期待: RLSポリシーエラー ✅
--    ```
--
-- =====================================
