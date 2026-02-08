-- ============================================
-- つくばホワイト歯科 LINEミニアプリ
-- プロファイルテーブル作成スクリプト
-- ============================================
-- 作成日: 2026-02-08
-- アプローチ: シンプル設計（id を TEXT 型）
-- ============================================

-- 既存のテーブルがあれば削除（開発環境のみ）
-- 本番環境では絶対に実行しないこと！
-- DROP TABLE IF EXISTS profiles CASCADE;

-- プロファイルテーブルの作成
CREATE TABLE IF NOT EXISTS profiles (
  -- 主キー: LINEのユーザーID (Uxxxxxxxxxxxx 形式) を直接格納
  id TEXT PRIMARY KEY,

  -- LINEユーザーID（冗長だが将来の拡張性のため保持）
  line_user_id TEXT UNIQUE NOT NULL,

  -- ユーザー表示名
  display_name TEXT,

  -- プロフィール画像URL
  picture_url TEXT,

  -- スタンプ数（来院回数）
  stamp_count INTEGER DEFAULT 0,

  -- 診察券番号（任意）
  ticket_number TEXT,

  -- 最終来院日
  last_visit_date TIMESTAMPTZ,

  -- 作成日時
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 更新日時
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- インデックスの作成
-- ============================================

-- line_user_id での検索用インデックス
CREATE INDEX IF NOT EXISTS idx_profiles_line_user_id
  ON profiles(line_user_id);

-- 最終来院日での検索用インデックス（リマインド機能で使用）
CREATE INDEX IF NOT EXISTS idx_profiles_last_visit_date
  ON profiles(last_visit_date);

-- ============================================
-- Row Level Security (RLS) の設定
-- ============================================

-- RLSを有効化
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ポリシー1: 全員が閲覧可能
-- 将来的に「自分のデータのみ」に変更する場合は、このポリシーを修正
CREATE POLICY "allow_public_read"
  ON profiles
  FOR SELECT
  USING (true);

-- ポリシー2: 全員が挿入可能
CREATE POLICY "allow_public_insert"
  ON profiles
  FOR INSERT
  WITH CHECK (true);

-- ポリシー3: 全員が更新可能
CREATE POLICY "allow_public_update"
  ON profiles
  FOR UPDATE
  USING (true);

-- ============================================
-- コメントの追加（ドキュメント化）
-- ============================================

COMMENT ON TABLE profiles IS 'つくばホワイト歯科 患者プロファイル';
COMMENT ON COLUMN profiles.id IS 'LINEユーザーID (主キー)';
COMMENT ON COLUMN profiles.line_user_id IS 'LINEユーザーID (冗長だが将来の拡張用)';
COMMENT ON COLUMN profiles.display_name IS 'LINEの表示名';
COMMENT ON COLUMN profiles.picture_url IS 'LINEプロフィール画像URL';
COMMENT ON COLUMN profiles.stamp_count IS '来院スタンプ数';
COMMENT ON COLUMN profiles.ticket_number IS '診察券番号（任意）';
COMMENT ON COLUMN profiles.last_visit_date IS '最終来院日時';

-- ============================================
-- テスト用データの挿入（オプション）
-- ============================================

-- 開発環境でのテスト用ダミーデータ
-- 本番環境では実行しないこと！
/*
INSERT INTO profiles (id, line_user_id, display_name, stamp_count)
VALUES
  ('U_test_user_001', 'U_test_user_001', 'テストユーザー1', 3),
  ('U_test_user_002', 'U_test_user_002', 'テストユーザー2', 7)
ON CONFLICT (id) DO NOTHING;
*/

-- ============================================
-- 完了メッセージ
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ profiles テーブルの作成が完了しました！';
  RAISE NOTICE '📊 テーブル名: profiles';
  RAISE NOTICE '🔑 主キー: id (TEXT型, LINEユーザーID)';
  RAISE NOTICE '🔐 RLS: 有効（全員アクセス可能）';
END $$;
