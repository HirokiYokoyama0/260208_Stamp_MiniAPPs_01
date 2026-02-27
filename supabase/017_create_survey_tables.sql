-- ============================================
-- つくばホワイト歯科 LINEミニアプリ
-- アンケート機能テーブル作成スクリプト
-- ============================================
-- 作成日: 2026-02-26
-- 対象: Phase 1 - 固定質問形式のアンケート機能
-- 関連ドキュメント: Doc/85, Doc/86, Doc/87

-- ============================================
-- 1. surveys テーブル（アンケート定義）
-- ============================================

CREATE TABLE IF NOT EXISTS surveys (
  -- 主キー（アンケートID）
  id TEXT PRIMARY KEY,  -- 例: 'satisfaction_2026Q1'

  -- アンケート基本情報
  title TEXT NOT NULL,  -- 例: 'ご利用満足度アンケート'
  description TEXT,     -- 説明文

  -- 報酬設定
  reward_stamps INTEGER NOT NULL DEFAULT 3,  -- 報酬スタンプ数（10倍整数: 3 = 0.3スタンプ）

  -- 公開設定（86・87 では is_active で統一）
  is_active BOOLEAN NOT NULL DEFAULT true,  -- アンケートが公開中かどうか
  start_date TIMESTAMPTZ,                   -- 公開開始日
  end_date TIMESTAMPTZ,                     -- 公開終了日

  -- 管理情報
  created_by TEXT,  -- 作成者（スタッフID等、将来拡張用）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_surveys_is_active
  ON surveys(is_active) WHERE is_active = true;

-- RLS有効化
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;

-- anon keyで全件参照可能（アプリ層でフィルタ）
CREATE POLICY "anon_can_read_surveys"
  ON surveys FOR SELECT
  USING (true);

-- コメント
COMMENT ON TABLE surveys IS 'アンケート定義マスタ';
COMMENT ON COLUMN surveys.id IS 'アンケート識別子（例: satisfaction_2026Q1）';
COMMENT ON COLUMN surveys.reward_stamps IS '報酬スタンプ数（10倍整数: 3 = 0.3スタンプ）';
COMMENT ON COLUMN surveys.is_active IS '公開中フラグ（true=公開中）';

-- ============================================
-- 2. survey_answers テーブル（回答データ）
-- ============================================

CREATE TABLE IF NOT EXISTS survey_answers (
  -- 主キー
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 外部キー
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,

  -- Phase 1: 固定質問形式の回答データ
  q1_rating INTEGER,      -- Q1: 5段階評価（1〜5）
  q2_comment TEXT,        -- Q2: 自由記述
  q3_recommend INTEGER,   -- Q3: NPS推奨度（0〜10）

  -- メタ情報
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 重複回答防止（同じユーザーが同じアンケートに複数回答できないように）
  UNIQUE(user_id, survey_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_survey_answers_survey_id
  ON survey_answers(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_answers_user_id
  ON survey_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_survey_answers_created_at
  ON survey_answers(created_at);

-- RLS有効化
ALTER TABLE survey_answers ENABLE ROW LEVEL SECURITY;

-- anon keyで全件参照・挿入可能（アプリ層でuser_idフィルタ）
CREATE POLICY "anon_can_read_survey_answers"
  ON survey_answers FOR SELECT
  USING (true);

CREATE POLICY "anon_can_insert_survey_answers"
  ON survey_answers FOR INSERT
  WITH CHECK (true);

-- コメント
COMMENT ON TABLE survey_answers IS 'アンケート回答データ';
COMMENT ON COLUMN survey_answers.q1_rating IS 'Q1: 満足度評価（1〜5）';
COMMENT ON COLUMN survey_answers.q2_comment IS 'Q2: 自由記述（任意）';
COMMENT ON COLUMN survey_answers.q3_recommend IS 'Q3: NPS推奨度（0〜10）';

-- ============================================
-- 3. survey_targets テーブル（配信対象者管理）
-- ============================================

CREATE TABLE IF NOT EXISTS survey_targets (
  -- 主キー
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 外部キー
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,

  -- 表示制御
  show_on_liff_open BOOLEAN NOT NULL DEFAULT false,  -- LIFFアプリ起動時にモーダル表示するか

  -- 表示状態管理
  shown_count INTEGER NOT NULL DEFAULT 0,            -- モーダル表示回数
  last_shown_at TIMESTAMPTZ,                         -- 最終表示日時

  -- 後回しカウント
  postponed_count INTEGER NOT NULL DEFAULT 0,        -- 「あとで」ボタンを押した回数
  last_postponed_at TIMESTAMPTZ,                     -- 最後に「あとで」を押した日時

  -- 回答状況
  answered_at TIMESTAMPTZ,                           -- 回答完了日時（NULLなら未回答）

  -- メタ情報
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 重複防止（同じユーザーが同じアンケートに複数のターゲットレコードを持たないように）
  UNIQUE(user_id, survey_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_survey_targets_user_id
  ON survey_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_survey_targets_survey_id
  ON survey_targets(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_targets_show_on_liff
  ON survey_targets(show_on_liff_open) WHERE show_on_liff_open = true;
CREATE INDEX IF NOT EXISTS idx_survey_targets_answered
  ON survey_targets(answered_at);

-- RLS有効化
ALTER TABLE survey_targets ENABLE ROW LEVEL SECURITY;

-- anon keyで全件参照・更新可能（アプリ層でuser_idフィルタ）
CREATE POLICY "anon_can_read_survey_targets"
  ON survey_targets FOR SELECT
  USING (true);

CREATE POLICY "anon_can_update_survey_targets"
  ON survey_targets FOR UPDATE
  USING (true);

CREATE POLICY "anon_can_insert_survey_targets"
  ON survey_targets FOR INSERT
  WITH CHECK (true);

-- コメント
COMMENT ON TABLE survey_targets IS 'アンケート配信対象者管理';
COMMENT ON COLUMN survey_targets.show_on_liff_open IS 'LIFFアプリ起動時にモーダル表示するか';
COMMENT ON COLUMN survey_targets.shown_count IS 'モーダル表示回数（統計用）';
COMMENT ON COLUMN survey_targets.postponed_count IS '「あとで」を押した回数';
COMMENT ON COLUMN survey_targets.answered_at IS '回答完了日時（NULLなら未回答）';

-- ============================================
-- 4. RPC関数: increment_survey_postponed
-- ============================================

-- 「あとで」ボタン押下時に postponed_count と last_postponed_at を更新
-- また、shown_count と last_shown_at も更新（表示したことになるため）
CREATE OR REPLACE FUNCTION increment_survey_postponed(
  p_user_id TEXT,
  p_survey_id TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE survey_targets
  SET
    postponed_count = postponed_count + 1,
    last_postponed_at = NOW(),
    shown_count = shown_count + 1,
    last_shown_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND survey_id = p_survey_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_survey_postponed IS 'アンケート「あとで」押下時のカウンタ更新';

-- ============================================
-- 5. ビュー: survey_target_status（管理画面用）
-- ============================================

-- 管理画面で「誰が回答済み/未回答か」を確認するためのビュー
CREATE OR REPLACE VIEW survey_target_status AS
SELECT
  st.id,
  st.survey_id,
  s.title AS survey_title,
  st.user_id,
  p.real_name,
  p.display_name,
  st.show_on_liff_open,
  st.shown_count,
  st.last_shown_at,
  st.postponed_count,
  st.last_postponed_at,
  st.answered_at,
  CASE
    WHEN st.answered_at IS NOT NULL THEN '回答済み'
    ELSE '未回答'
  END AS status,
  st.created_at,
  st.updated_at
FROM survey_targets st
JOIN surveys s ON st.survey_id = s.id
JOIN profiles p ON st.user_id = p.id;

COMMENT ON VIEW survey_target_status IS 'アンケート配信対象者の状態一覧（管理画面用）';

-- ============================================
-- 6. 初期データ: サンプルアンケート
-- ============================================

-- 第1回 満足度調査（サンプル）
INSERT INTO surveys (id, title, description, reward_stamps, is_active, start_date, end_date, created_by)
VALUES (
  'satisfaction_2026Q1',
  'ご利用満足度アンケート',
  '当院のサービスについてお聞かせください。ご回答いただくとスタンプ3個をプレゼント！',
  30,  -- 3スタンプ（10倍整数）
  true,
  '2026-02-26 00:00:00+09',
  '2026-03-31 23:59:59+09',
  'system'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 完了メッセージ
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'アンケート機能テーブル作成完了';
  RAISE NOTICE '========================================';
  RAISE NOTICE '作成されたテーブル:';
  RAISE NOTICE '  - surveys (アンケート定義)';
  RAISE NOTICE '  - survey_answers (回答データ)';
  RAISE NOTICE '  - survey_targets (配信対象者管理)';
  RAISE NOTICE '';
  RAISE NOTICE '作成されたビュー:';
  RAISE NOTICE '  - survey_target_status (管理画面用)';
  RAISE NOTICE '';
  RAISE NOTICE '作成されたRPC関数:';
  RAISE NOTICE '  - increment_survey_postponed()';
  RAISE NOTICE '';
  RAISE NOTICE '初期データ:';
  RAISE NOTICE '  - satisfaction_2026Q1 (サンプルアンケート)';
  RAISE NOTICE '========================================';
END $$;
