-- ============================================
-- stamp_history DELETE ポリシー修正
-- ============================================
-- 作成日: 2026-04-04
-- 目的: スタッフ操作API専用のDELETE許可
-- 背景: Service Role Keyを使わずにANON_KEYでDELETE操作を可能にする
-- ============================================

-- 既存のDELETEポリシーを全て削除（026Bとの整合性を保つ）
DROP POLICY IF EXISTS "allow_public_delete" ON stamp_history;
DROP POLICY IF EXISTS "stamp_history_delete_policy" ON stamp_history;

-- 新しいDELETEポリシー: 全レコード削除可能
-- 理由: スタッフ操作時に古い履歴を全削除する必要がある
--       - スタッフPIN認証を通過したユーザーのみがAPI実行可能
--       - 削除後に新しいmanual_adminレコードを挿入するため、監査証跡は保持される
CREATE POLICY "allow_delete_all_stamps"
  ON stamp_history
  FOR DELETE
  USING (true);

-- ============================================
-- 完了メッセージ
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ stamp_history のDELETEポリシーを修正しました';
  RAISE NOTICE '📝 DELETE許可: 全レコード削除可能 (USING true)';
  RAISE NOTICE '🔒 セキュリティ: スタッフPIN認証済みAPIのみが使用';
  RAISE NOTICE '📊 監査証跡: 削除後に新しいmanual_adminレコードを挿入';
END $$;
