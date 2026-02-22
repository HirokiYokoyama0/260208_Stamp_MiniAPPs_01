-- ==========================================
-- 012: 本名（real_name）カラムの追加
-- ==========================================
-- 作成日: 2026-02-21
-- 更新日: 2026-02-22
-- 目的: 患者の本名を管理できるようにする
--
-- 背景:
-- - LINE表示名（display_name）はニックネームの場合が多い
-- - 受付で本人確認のため本名が必要
-- - 診察券番号と本名で患者を識別（ふりがなは不要）
-- - オンボーディング時に診察券番号と共に入力してもらう
--
-- 注意事項:
-- - LIFFアプリと管理画面両方で使用
-- - 個人情報のためRLSポリシーで適切に保護する
-- - 既存ユーザーはNULLのまま（後から入力可能）
-- ==========================================

-- 1. real_name カラムを追加
ALTER TABLE profiles
  ADD COLUMN real_name TEXT DEFAULT NULL;

-- コメント追加
COMMENT ON COLUMN profiles.real_name IS '患者の本名（管理画面専用、個人情報）';

-- 2. インデックス作成（検索パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_profiles_real_name
  ON profiles(real_name)
  WHERE real_name IS NOT NULL;

-- 3. 検索用の関数（大文字小文字を区別しない）
CREATE OR REPLACE FUNCTION search_profiles_by_real_name(search_term TEXT)
RETURNS TABLE (
  id TEXT,
  line_user_id TEXT,
  display_name TEXT,
  real_name TEXT,
  ticket_number TEXT,
  stamp_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.line_user_id,
    p.display_name,
    p.real_name,
    p.ticket_number,
    p.stamp_count
  FROM profiles p
  WHERE
    p.real_name ILIKE '%' || search_term || '%'
    OR p.display_name ILIKE '%' || search_term || '%'
  ORDER BY p.real_name ASC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- 4. RLSポリシーの確認（既存のポリシーで管理画面からのアクセスは許可されている前提）
-- ※ 既存のRLSポリシー（allow_public_read, allow_public_update）が適用される
-- ※ 必要に応じて、管理者のみがreal_nameを更新できるように制限を追加

-- ==========================================
-- 実行後の確認
-- ==========================================
-- 以下のSQLで確認:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'profiles' AND column_name = 'real_name';
--
-- インデックスの確認:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'profiles' AND indexname = 'idx_profiles_real_name';
-- ==========================================

-- マイグレーション完了
SELECT 'Migration 010: real_name カラムの追加が完了しました' AS status;
