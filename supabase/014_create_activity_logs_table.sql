-- ============================================
-- スタッフ操作ログ（activity_logs）
-- 23_イベントログ設計（スタッフ操作ログ）.md に準拠
-- ============================================

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_staff_id ON activity_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);

COMMENT ON TABLE activity_logs IS 'スタッフ操作ログ（監査・確認用）。追記のみ。';
COMMENT ON COLUMN activity_logs.staff_id IS '操作したスタッフ（FK → staff.id）。NULL = 従来の環境変数ログイン（admin）';
COMMENT ON COLUMN activity_logs.action IS '操作種別（login, profile_update, stamp_increment 等）';
COMMENT ON COLUMN activity_logs.target_type IS '対象の種類（profile, reward_exchange, family 等）';
COMMENT ON COLUMN activity_logs.target_id IS '対象のID';
COMMENT ON COLUMN activity_logs.details IS '補足（任意）';

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 開発・本番とも API は service_role（admin client）で INSERT する想定のため、
-- anon 用のポリシーは付与しない。SELECT のみ必要なら後からポリシーを追加する。
