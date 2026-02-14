-- ============================================================
-- 006_add_next_memo_columns.sql
-- 次回メモ機能のためのカラム追加
-- ============================================================

-- profilesテーブルに次回メモ関連のカラムを追加
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS next_visit_date DATE,
  ADD COLUMN IF NOT EXISTS next_memo TEXT,
  ADD COLUMN IF NOT EXISTS next_memo_updated_at TIMESTAMPTZ;

-- コメント追加
COMMENT ON COLUMN profiles.next_visit_date IS '次回来院予定日';
COMMENT ON COLUMN profiles.next_memo IS 'ユーザーへの次回メモ（カスタムメッセージ）';
COMMENT ON COLUMN profiles.next_memo_updated_at IS '次回メモの最終更新日時';

-- インデックス追加（次回来院予定日での検索に使用）
CREATE INDEX IF NOT EXISTS idx_profiles_next_visit_date
  ON profiles(next_visit_date)
  WHERE next_visit_date IS NOT NULL;

-- ============================================================
-- トリガー関数: next_memo_updated_at の自動更新
-- ============================================================

-- トリガー関数を作成（next_visit_date または next_memo が変更された場合に自動更新）
CREATE OR REPLACE FUNCTION update_next_memo_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- next_visit_date または next_memo が変更された場合のみ更新
  IF (NEW.next_visit_date IS DISTINCT FROM OLD.next_visit_date)
     OR (NEW.next_memo IS DISTINCT FROM OLD.next_memo) THEN
    NEW.next_memo_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーを作成（profiles テーブルの UPDATE 時に実行）
DROP TRIGGER IF EXISTS trigger_update_next_memo_timestamp ON profiles;
CREATE TRIGGER trigger_update_next_memo_timestamp
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_next_memo_timestamp();

-- ============================================================
-- 実行確認
-- ============================================================

-- カラムの確認
SELECT
  column_name,
  data_type,
  is_nullable
FROM
  information_schema.columns
WHERE
  table_name = 'profiles'
  AND column_name IN ('next_visit_date', 'next_memo', 'next_memo_updated_at')
ORDER BY
  ordinal_position;

-- トリガーの確認
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM
  information_schema.triggers
WHERE
  trigger_name = 'trigger_update_next_memo_timestamp';
