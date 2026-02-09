-- ============================================
-- つくばホワイト歯科 LINEミニアプリ
-- スタンプ履歴テーブル作成スクリプト
-- ============================================

-- スタンプ履歴テーブルの作成
CREATE TABLE IF NOT EXISTS stamp_history (
  -- 主キー（UUID）
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 外部キー: profilesテーブルのユーザーID
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- 来院日時（ユーザーが来院した実際の日時）
  visit_date TIMESTAMPTZ NOT NULL,

  -- スタンプ番号（順序付け用: 1, 2, 3...）
  stamp_number INTEGER NOT NULL,

  -- スタンプ取得方式
  stamp_method TEXT DEFAULT 'qr_scan',  -- 値: 'qr_scan', 'manual_admin', 'import'

  -- QRコードの一意なコード（重複防止用）
  qr_code_id TEXT,

  -- 管理用の備考（管理者が手動付与した場合など）
  notes TEXT,

  -- レコード作成日時（いつシステムに記録されたか）
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 更新日時（修正された場合など）
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- インデックス
-- ============================================

-- ユーザーごとのスタンプ履歴を高速に取得
CREATE INDEX IF NOT EXISTS idx_stamp_history_user_id
  ON stamp_history(user_id);

-- 来院日時での検索（カレンダービュー等で使用）
CREATE INDEX IF NOT EXISTS idx_stamp_history_visit_date
  ON stamp_history(visit_date);

-- ユーザーID + 来院日時の複合インデックス（重複チェック用）
CREATE INDEX IF NOT EXISTS idx_stamp_history_user_date
  ON stamp_history(user_id, DATE(visit_date));

-- QRコードID での検索（重複登録防止）
CREATE INDEX IF NOT EXISTS idx_stamp_history_qr_code_id
  ON stamp_history(qr_code_id)
  WHERE qr_code_id IS NOT NULL;

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE stamp_history ENABLE ROW LEVEL SECURITY;

-- 全員が読み取り可能
CREATE POLICY "allow_public_read"
  ON stamp_history
  FOR SELECT
  USING (true);

-- 全員が挿入可能（初期実装）
CREATE POLICY "allow_public_insert"
  ON stamp_history
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- トリガー関数: profiles自動更新
-- ============================================

-- スタンプ履歴が追加されたらprofilesテーブルを自動更新
CREATE OR REPLACE FUNCTION update_profile_stamp_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET
    stamp_count = (
      SELECT COALESCE(MAX(stamp_number), 0)
      FROM stamp_history
      WHERE user_id = NEW.user_id
    ),
    last_visit_date = (
      SELECT MAX(visit_date)
      FROM stamp_history
      WHERE user_id = NEW.user_id
    ),
    updated_at = NOW()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー作成
CREATE TRIGGER trigger_update_profile_stamp_count
AFTER INSERT ON stamp_history
FOR EACH ROW
EXECUTE FUNCTION update_profile_stamp_count();

-- ============================================
-- コメント（ドキュメント化）
-- ============================================

COMMENT ON TABLE stamp_history IS 'つくばホワイト歯科 スタンプ取得履歴';
COMMENT ON COLUMN stamp_history.id IS '履歴レコードの一意識別子';
COMMENT ON COLUMN stamp_history.user_id IS 'ユーザーID (profiles.idへの外部キー)';
COMMENT ON COLUMN stamp_history.visit_date IS '実際の来院日時';
COMMENT ON COLUMN stamp_history.stamp_number IS 'スタンプの順序番号';
COMMENT ON COLUMN stamp_history.stamp_method IS 'スタンプの取得方式 (qr_scan/manual_admin/import)';
COMMENT ON COLUMN stamp_history.qr_code_id IS 'QRコードの一意識別子（重複防止用）';
COMMENT ON COLUMN stamp_history.notes IS '管理者による備考（オプション）';
