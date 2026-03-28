-- ==========================================
-- 025: 誕生月（birth_month）カラムの追加
-- ==========================================
-- 作成日: 2026-03-28
-- 目的: 誕生月クーポン配信のため、患者の誕生月を管理
--
-- 背景:
-- - 誕生月に特別クーポンを配信する機能を追加
-- - LIFFアプリのオンボーディング時に、氏名・診察券番号と共に誕生月を入力
-- - 管理ダッシュボードで誕生月による一斉配信の絞り込みが可能
--
-- データ型:
-- - INTEGER (1-12) を使用
-- - 1=1月, 2=2月, ..., 12=12月
-- - NULL許容（既存ユーザーは未登録の状態）
--
-- 注意事項:
-- - 誕生日ではなく「誕生月」のみを管理（プライバシー配慮）
-- - CHECK制約で1-12の範囲のみ許可
-- - 既存ユーザーはNULL（オンボーディング時または管理画面で後から入力）
-- ==========================================

-- 1. birth_month カラムを追加
ALTER TABLE profiles
  ADD COLUMN birth_month INTEGER DEFAULT NULL
  CHECK (birth_month >= 1 AND birth_month <= 12);

-- コメント追加
COMMENT ON COLUMN profiles.birth_month IS '誕生月（1-12、1=1月、12=12月、誕生月クーポン配信用）';

-- 2. インデックス作成（誕生月での絞り込み検索用）
CREATE INDEX IF NOT EXISTS idx_profiles_birth_month
  ON profiles(birth_month)
  WHERE birth_month IS NOT NULL;

-- 3. 誕生月による検索用の便利関数
CREATE OR REPLACE FUNCTION get_users_by_birth_month(target_month INTEGER)
RETURNS TABLE (
  id TEXT,
  line_user_id TEXT,
  display_name TEXT,
  real_name TEXT,
  ticket_number TEXT,
  birth_month INTEGER,
  stamp_count INTEGER,
  is_line_friend BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.line_user_id,
    p.display_name,
    p.real_name,
    p.ticket_number,
    p.birth_month,
    p.stamp_count,
    p.is_line_friend
  FROM profiles p
  WHERE
    p.birth_month = target_month
    AND p.is_line_friend = true  -- 公式アカ友だち登録済みのみ
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_users_by_birth_month(INTEGER) IS '指定された誕生月のユーザーを取得（LINE友だち登録済みのみ）';

-- 4. 現在の月の誕生日ユーザーを取得する関数
CREATE OR REPLACE FUNCTION get_current_month_birthdays()
RETURNS TABLE (
  id TEXT,
  line_user_id TEXT,
  display_name TEXT,
  real_name TEXT,
  ticket_number TEXT,
  birth_month INTEGER,
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
    p.birth_month,
    p.stamp_count
  FROM profiles p
  WHERE
    p.birth_month = EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
    AND p.is_line_friend = true
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_current_month_birthdays() IS '今月が誕生月のユーザーを取得（自動配信用）';

-- ==========================================
-- 実行後の確認
-- ==========================================
-- カラムの確認:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'profiles' AND column_name = 'birth_month';
--
-- CHECK制約の確認:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'profiles'::regclass
-- AND contype = 'c';
--
-- インデックスの確認:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'profiles' AND indexname = 'idx_profiles_birth_month';
--
-- 関数のテスト（1月生まれのユーザーを取得）:
-- SELECT * FROM get_users_by_birth_month(1);
--
-- 今月の誕生月ユーザーを取得:
-- SELECT * FROM get_current_month_birthdays();
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE '✅ birth_month カラムの追加が完了しました！';
  RAISE NOTICE '📅 誕生月: 1-12の整数（NULL許容）';
  RAISE NOTICE '🔍 インデックス: idx_profiles_birth_month 作成済み';
  RAISE NOTICE '⚙️  関数: get_users_by_birth_month(month) 作成済み';
  RAISE NOTICE '⚙️  関数: get_current_month_birthdays() 作成済み';
  RAISE NOTICE '🎂 誕生月クーポン配信機能の準備完了！';
END $$;

-- マイグレーション完了
SELECT 'Migration 025: birth_month カラムの追加が完了しました' AS status;
