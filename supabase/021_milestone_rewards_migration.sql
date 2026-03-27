-- ========================================
-- マイルストーン型特典システムへの移行
-- ファイル: 021_milestone_rewards_migration.sql
-- 作成日: 2026-03-27
-- 参照: Doc_dashboard/55_特典仕様変更.md
--       Doc_dashboard/57_マイグレーション計画.md
-- ========================================

-- ========================================
-- Step 1: 新規テーブル作成
-- ========================================

-- 1-1. milestone_rewards テーブル（マイルストーン型特典マスター）
CREATE TABLE IF NOT EXISTS milestone_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,

  -- マイルストーンルール
  milestone_type TEXT NOT NULL CHECK (milestone_type IN ('every_10', 'every_50', 'every_150_from_300')),

  -- 初回特別対応（POIC用）
  is_first_time_special BOOLEAN DEFAULT false,
  first_time_description TEXT,
  subsequent_description TEXT,

  -- 有効期限（月数、NULL = 無期限）
  validity_months INTEGER,

  -- 表示順・有効フラグ
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  -- 内部用フィールド
  reward_type TEXT NOT NULL CHECK (reward_type IN ('toothbrush', 'poic', 'premium_menu')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE milestone_rewards IS 'マイルストーン型特典マスターテーブル';
COMMENT ON COLUMN milestone_rewards.milestone_type IS 'マイルストーンルール: every_10（10の倍数）, every_50（50の倍数）, every_150_from_300（300 + 150の倍数）';
COMMENT ON COLUMN milestone_rewards.reward_type IS '特典種別（内部識別用）: toothbrush, poic, premium_menu';

-- 1-2. milestone_history テーブル（マイルストーン到達履歴）
CREATE TABLE IF NOT EXISTS milestone_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  milestone INTEGER NOT NULL,
  reached_at TIMESTAMPTZ DEFAULT NOW(),

  -- 付与された特典のID（通常1つのみ）
  reward_exchange_id UUID REFERENCES reward_exchanges(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 同じユーザーが同じマイルストーンに複数回到達しないように
  UNIQUE(user_id, milestone)
);

CREATE INDEX idx_milestone_history_user ON milestone_history(user_id);
CREATE INDEX idx_milestone_history_milestone ON milestone_history(milestone);

COMMENT ON TABLE milestone_history IS 'ユーザーのマイルストーン到達履歴';

-- ========================================
-- Step 2: 既存テーブルへのカラム追加
-- ========================================

-- 2-1. reward_exchanges テーブルにカラム追加
ALTER TABLE reward_exchanges
  -- どのマイルストーンで付与されたか
  ADD COLUMN IF NOT EXISTS milestone_reached INTEGER,

  -- 有効期限（NULL = 無期限）
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,

  -- 初回特典かどうか（POIC本体込など）
  ADD COLUMN IF NOT EXISTS is_first_time BOOLEAN DEFAULT false,

  -- 既存データとの区別用フラグ（新仕様 = true）
  ADD COLUMN IF NOT EXISTS is_milestone_based BOOLEAN DEFAULT false;

COMMENT ON COLUMN reward_exchanges.milestone_reached IS 'マイルストーン到達数（例: 10, 50, 300）';
COMMENT ON COLUMN reward_exchanges.valid_until IS '有効期限（自費メニュー用）';
COMMENT ON COLUMN reward_exchanges.is_first_time IS '初回特典かどうか（POIC本体込など）';
COMMENT ON COLUMN reward_exchanges.is_milestone_based IS 'マイルストーン型の特典かどうか（true = 新仕様, false = 旧仕様）';

-- 2-2. status の CHECK 制約を更新（expired を追加）
ALTER TABLE reward_exchanges
DROP CONSTRAINT IF EXISTS reward_exchanges_status_check;

ALTER TABLE reward_exchanges
ADD CONSTRAINT reward_exchanges_status_check
CHECK (status IN ('pending', 'completed', 'cancelled', 'expired'));

COMMENT ON COLUMN reward_exchanges.status IS 'ステータス: pending（未引渡）, completed（引渡済）, cancelled（キャンセル）, expired（期限切れ）';

-- ========================================
-- Step 3: 初期データ投入
-- ========================================

-- 3-1. マイルストーン型特典マスターデータ
INSERT INTO milestone_rewards (name, description, milestone_type, is_first_time_special, first_time_description, subsequent_description, validity_months, reward_type, display_order, is_active)
VALUES
  -- 歯ブラシ（10の倍数）
  (
    '歯ブラシ 1本',
    'TePeミニ / コンパクト / ピセラ / 替えブラシ 等から選択',
    'every_10',
    false,
    NULL,
    NULL,
    0, -- 0 = 当日限り（特別処理）
    'toothbrush',
    1,
    true
  ),

  -- POIC殺菌剤（50の倍数）
  (
    'POIC殺菌剤',
    'POICウォーター（口腔内除菌水）',
    'every_50',
    true, -- 初回は特別
    '初回のみ本体ごとプレゼント',
    '2回目以降は補充用のみ',
    5, -- 5ヶ月有効
    'poic',
    2,
    true
  ),

  -- 選べる自費メニュー（300 + 150の倍数）
  (
    '選べる自費メニュー',
    '小顔エステ10%OFF / ホワイトニング10%OFF / その他自費10%OFFクーポン から選択',
    'every_150_from_300',
    false,
    NULL,
    NULL,
    5, -- 5ヶ月有効
    'premium_menu',
    3,
    true
  )
ON CONFLICT DO NOTHING;

COMMENT ON COLUMN milestone_rewards.validity_months IS '有効期限（月数）: 0 = 当日限り, NULL = 無期限, その他 = Nヶ月';

-- ========================================
-- Step 4: RLSポリシー設定
-- ========================================

-- 4-1. milestone_rewards テーブルのRLS
ALTER TABLE milestone_rewards ENABLE ROW LEVEL SECURITY;

-- 全ユーザー読み取り可能（特典一覧表示用）
CREATE POLICY "milestone_rewards_public_read"
  ON milestone_rewards
  FOR SELECT
  USING (true);

-- 管理者のみ変更可能（将来的に管理画面を追加する場合）
CREATE POLICY "milestone_rewards_admin_all"
  ON milestone_rewards
  FOR ALL
  USING (true);

-- 4-2. milestone_history テーブルのRLS
ALTER TABLE milestone_history ENABLE ROW LEVEL SECURITY;

-- 自分の履歴のみ読み取り可能
CREATE POLICY "milestone_history_user_read"
  ON milestone_history
  FOR SELECT
  USING (true);

-- システムのみ挿入可能
CREATE POLICY "milestone_history_system_insert"
  ON milestone_history
  FOR INSERT
  WITH CHECK (true);

-- ========================================
-- Step 5: トリガー関数（オプション）
-- ========================================

-- 5-1. 有効期限切れ自動更新トリガー（日次バッチで実行）
CREATE OR REPLACE FUNCTION expire_old_rewards()
RETURNS void AS $$
BEGIN
  UPDATE reward_exchanges
  SET status = 'expired'
  WHERE status IN ('pending', 'completed')
    AND valid_until IS NOT NULL
    AND valid_until < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_old_rewards IS '有効期限切れの特典を自動的にexpiredに変更（日次バッチで実行）';

-- ========================================
-- Step 6: インデックス作成
-- ========================================

-- milestone_reached でフィルタすることが多い
CREATE INDEX IF NOT EXISTS idx_reward_exchanges_milestone
  ON reward_exchanges(milestone_reached);

-- 有効期限でソートすることがある
CREATE INDEX IF NOT EXISTS idx_reward_exchanges_valid_until
  ON reward_exchanges(valid_until);

-- マイルストーン型かどうかでフィルタ
CREATE INDEX IF NOT EXISTS idx_reward_exchanges_milestone_based
  ON reward_exchanges(is_milestone_based);

-- ========================================
-- 確認クエリ
-- ========================================

-- マイルストーン型特典マスターの確認
-- SELECT * FROM milestone_rewards ORDER BY display_order;

-- reward_exchanges の新カラム確認
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'reward_exchanges'
--   AND column_name IN ('milestone_reached', 'valid_until', 'is_first_time', 'is_milestone_based');

-- ========================================
-- ロールバック用SQL（必要に応じて）
-- ========================================

-- DROP TABLE IF EXISTS milestone_history CASCADE;
-- DROP TABLE IF EXISTS milestone_rewards CASCADE;
--
-- ALTER TABLE reward_exchanges
--   DROP COLUMN IF EXISTS milestone_reached,
--   DROP COLUMN IF EXISTS valid_until,
--   DROP COLUMN IF EXISTS is_first_time,
--   DROP COLUMN IF EXISTS is_milestone_based;
--
-- DROP FUNCTION IF EXISTS expire_old_rewards();

-- ========================================
-- マイグレーション完了
-- ========================================
