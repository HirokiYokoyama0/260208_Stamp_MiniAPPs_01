-- ========================================
-- マイグレーション: 家族ひもづけ機能対応
-- ファイル: 009_add_family_support.sql
-- 作成日: 2026-02-16
-- ========================================
--
-- 【目的】
-- 家族単位でスタンプを共有できる仕組みを追加
-- - 1つの家族（世帯）= 複数のメンバー（profiles）
-- - 家族の合計スタンプ数はVIEWで計算
-- - 既存ユーザーは全員「単身家族」として初期化
--
-- 【変更内容】
-- 1. families テーブル作成（家族の実体）
-- 2. profiles テーブルに family_id, family_role カラム追加
-- 3. family_stamp_totals ビュー作成（家族の合計スタンプ数を計算）
-- 4. 既存ユーザーに単身家族を作成
--
-- ========================================

-- ① families テーブルの作成
-- 注: profiles.id は TEXT 型なので、representative_user_id も TEXT 型にする
CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  family_name TEXT NOT NULL,
  representative_user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_families_representative ON families(representative_user_id);

-- コメント追加
COMMENT ON TABLE families IS '家族（世帯）の実体テーブル';
COMMENT ON COLUMN families.id IS '家族ID（主キー）';
COMMENT ON COLUMN families.family_name IS '家族名（例: 横山家）';
COMMENT ON COLUMN families.representative_user_id IS '代表者のprofiles.id';
COMMENT ON COLUMN families.created_at IS '家族作成日時';
COMMENT ON COLUMN families.updated_at IS '家族情報更新日時';

-- ② profiles テーブルに家族関連カラムを追加
-- 注: RLSポリシーより先に追加する必要がある
-- 注: families.id は TEXT 型なので、family_id も TEXT 型にする
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS family_id TEXT REFERENCES families(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS family_role TEXT DEFAULT 'child'
    CHECK (family_role IN ('parent', 'child'));

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_profiles_family_id ON profiles(family_id);

-- コメント追加
COMMENT ON COLUMN profiles.family_id IS '所属する家族のID（families.idへの参照）';
COMMENT ON COLUMN profiles.family_role IS '家族内の役割（parent: 保護者/代表者, child: 子ども/メンバー）';

-- ③ families テーブルのRLS設定
-- 注: このプロジェクトではSupabase Authを使用していないため、全公開ポリシーを使用
-- 注: LINE認証（LIFF）を使用し、auth.uid() は NULL を返す
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

-- 全員が閲覧可能（既存のprofilesテーブルと同じポリシー）
CREATE POLICY "allow_public_read"
  ON families
  FOR SELECT
  USING (true);

-- 全員が挿入可能（新規ユーザー登録時に必要）
CREATE POLICY "allow_public_insert"
  ON families
  FOR INSERT
  WITH CHECK (true);

-- 全員が更新可能（管理ダッシュボードで必要）
CREATE POLICY "allow_public_update"
  ON families
  FOR UPDATE
  USING (true);

-- 全員が削除可能（管理ダッシュボードで必要）
CREATE POLICY "allow_public_delete"
  ON families
  FOR DELETE
  USING (true);

-- ④ family_stamp_totals ビューの作成
-- 家族の合計スタンプ数・来院回数を計算
CREATE OR REPLACE VIEW family_stamp_totals AS
SELECT
  f.id AS family_id,
  f.family_name,
  f.representative_user_id,
  SUM(p.stamp_count) AS total_stamp_count,
  SUM(p.visit_count) AS total_visit_count,
  COUNT(p.id) AS member_count,
  MAX(p.last_visit_date) AS last_family_visit,
  MAX(p.updated_at) AS last_family_login,
  f.created_at,
  f.updated_at
FROM families f
LEFT JOIN profiles p ON p.family_id = f.id
GROUP BY f.id, f.family_name, f.representative_user_id, f.created_at, f.updated_at;

COMMENT ON VIEW family_stamp_totals IS '家族の合計スタンプ数・来院回数を計算するビュー';

-- ⑤ families.updated_at の自動更新トリガー
CREATE OR REPLACE FUNCTION update_families_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_families_updated_at
  BEFORE UPDATE ON families
  FOR EACH ROW
  EXECUTE FUNCTION update_families_updated_at();

COMMENT ON FUNCTION update_families_updated_at() IS 'families テーブルの updated_at を自動更新';

-- ⑥ 既存ユーザーに単身家族を作成
-- 注: この処理は既存データがある場合のみ実行される
DO $$
DECLARE
  profile_record RECORD;
  new_family_id TEXT;
BEGIN
  -- family_id が NULL のユーザーのみ処理
  FOR profile_record IN
    SELECT id, display_name
    FROM profiles
    WHERE family_id IS NULL
  LOOP
    -- 単身家族を作成
    INSERT INTO families (family_name, representative_user_id)
    VALUES (
      COALESCE(profile_record.display_name, 'ユーザー') || 'の家族',
      profile_record.id
    )
    RETURNING id INTO new_family_id;

    -- profilesテーブルを更新
    UPDATE profiles
    SET
      family_id = new_family_id,
      family_role = 'parent'
    WHERE id = profile_record.id;

    RAISE NOTICE '単身家族を作成: % (ID: %)', profile_record.display_name, profile_record.id;
  END LOOP;

  RAISE NOTICE '✅ 既存ユーザーへの単身家族作成が完了しました';
END $$;

-- ========================================
-- マイグレーション完了
-- ========================================
--
-- 【確認SQL】
-- -- 家族一覧とメンバー数
-- SELECT * FROM family_stamp_totals ORDER BY member_count DESC, total_stamp_count DESC;
--
-- -- 各ユーザーの家族情報
-- SELECT
--   p.id,
--   p.display_name,
--   p.stamp_count,
--   p.visit_count,
--   p.family_role,
--   f.family_name,
--   fst.total_stamp_count,
--   fst.total_visit_count,
--   fst.member_count
-- FROM profiles p
-- LEFT JOIN families f ON f.id = p.family_id
-- LEFT JOIN family_stamp_totals fst ON fst.family_id = p.family_id
-- ORDER BY p.stamp_count DESC;
--

