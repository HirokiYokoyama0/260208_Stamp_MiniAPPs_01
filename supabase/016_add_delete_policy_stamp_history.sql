-- ============================================
-- スタンプ履歴テーブル: DELETE/UPDATEポリシー追加
-- ============================================
-- 作成日: 2026-02-24
-- 目的: RLSバイパスを不要にするため、DELETEポリシーを追加
-- ============================================

-- 既存のポリシーを削除（再実行可能にするため）
DROP POLICY IF EXISTS "allow_public_delete" ON stamp_history;
DROP POLICY IF EXISTS "allow_public_update" ON stamp_history;

-- 全員が削除可能（初期実装）
-- 将来的に「自分のデータのみ」に変更する場合は、このポリシーを修正
CREATE POLICY "allow_public_delete"
  ON stamp_history
  FOR DELETE
  USING (true);

-- 全員が更新可能（初期実装）
CREATE POLICY "allow_public_update"
  ON stamp_history
  FOR UPDATE
  USING (true);

-- ============================================
-- 削除時のトリガー関数追加
-- ============================================

-- スタンプ履歴が削除されたらprofilesテーブルを自動更新
-- 注: stamp_count は SUM(amount) で計算（10倍整数システム対応）
CREATE OR REPLACE FUNCTION update_profile_on_stamp_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- 削除されたユーザーのスタンプ数を再計算
  UPDATE profiles
  SET
    -- stamp_count = 全履歴の amount の合計（10倍整数システム）
    stamp_count = (
      SELECT COALESCE(SUM(amount), 0)
      FROM stamp_history
      WHERE user_id = OLD.user_id
    ),
    -- visit_count = amount が 10 のレコード数（通常来院のみカウント）
    visit_count = (
      SELECT COUNT(*)
      FROM stamp_history
      WHERE user_id = OLD.user_id AND amount = 10
    ),
    -- last_visit_date = 最新の来院日時
    last_visit_date = (
      SELECT MAX(visit_date)
      FROM stamp_history
      WHERE user_id = OLD.user_id
    ),
    updated_at = NOW()
  WHERE id = OLD.user_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 既存のトリガーを削除（再実行可能にするため）
DROP TRIGGER IF EXISTS trigger_update_profile_on_stamp_delete ON stamp_history;

-- トリガー作成（削除時）
CREATE TRIGGER trigger_update_profile_on_stamp_delete
AFTER DELETE ON stamp_history
FOR EACH ROW
EXECUTE FUNCTION update_profile_on_stamp_delete();

-- ============================================
-- 完了メッセージ
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ stamp_history テーブルのDELETE/UPDATEポリシーを追加しました！';
  RAISE NOTICE '📝 DELETE: 全員が削除可能';
  RAISE NOTICE '📝 UPDATE: 全員が更新可能';
  RAISE NOTICE '🔄 削除時のトリガーも追加されました';
END $$;
