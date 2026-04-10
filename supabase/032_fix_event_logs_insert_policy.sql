-- =====================================
-- event_logs INSERT ポリシー修正
-- =====================================
-- 作成日: 2026-04-05
-- 目的: 031で作成したINSERTポリシーが機能していない問題を修正
--
-- 問題:
--   031実行後もINSERTが全て失敗している
--   原因: WITH CHECK の条件が厳しすぎる、またはNULL処理の問題
--
-- 修正:
--   user_id IS NULL を最初にチェック
--   正規表現の順序を最適化
-- =====================================

SELECT NOW() AS migration_032_started;

-- 既存のINSERTポリシーを削除
DROP POLICY IF EXISTS "event_logs_allow_insert_with_format_check" ON event_logs;

-- 新しいINSERTポリシーを作成（NULL処理を優先）
CREATE POLICY "event_logs_allow_insert_with_format_check"
  ON event_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id IS NULL OR                          -- 匿名イベント（user_id なし）
    user_id ~ '^U[0-9a-f]{32}$' OR             -- 本番 LINE User ID
    user_id ~ '^U_test_' OR                     -- テスト用 LINE User ID
    user_id LIKE 'manual-child-%'               -- 手動追加の子供アカウント
  );

COMMENT ON POLICY "event_logs_allow_insert_with_format_check" ON event_logs IS
  'LIFFアプリからのINSERTを許可（LINE User ID形式チェック付き、NULL許可）';

-- 確認
SELECT
  policyname,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'event_logs'
  AND policyname = 'event_logs_allow_insert_with_format_check';

SELECT NOW() AS migration_032_completed;

-- =====================================
-- テスト手順
-- =====================================
--
-- Node.jsで実行:
--   node scripts/test-insert-event-log.mjs
--
-- 期待される結果:
--   テスト1 (U_test_形式):    ✅ 成功
--   テスト2 (本番形式):       ✅ 成功
--   テスト3 (不正形式):       ✅ 正常にブロック
-- =====================================
