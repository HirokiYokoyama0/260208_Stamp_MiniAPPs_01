-- ============================================
-- スタッフテーブル（管理画面ログイン用）
-- 22_スタッフごとアカウント仕様 に準拠
-- ============================================

CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_login_id ON staff(login_id);
CREATE INDEX IF NOT EXISTS idx_staff_is_active ON staff(is_active) WHERE is_active = true;

COMMENT ON TABLE staff IS '管理画面ログイン用スタッフアカウント';
COMMENT ON COLUMN staff.login_id IS 'ログインID（一意）';
COMMENT ON COLUMN staff.password_hash IS 'パスワードのハッシュ（bcrypt）';
COMMENT ON COLUMN staff.display_name IS '表示名';
COMMENT ON COLUMN staff.is_active IS '有効フラグ。false の場合はログイン不可';

-- RLS: 有効にすると anon はデフォルトでアクセス不可。
-- 管理画面API は service_role でアクセスするため RLS を通過しない。
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
