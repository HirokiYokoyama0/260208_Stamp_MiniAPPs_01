-- =============================================
-- 特典システムのテーブル作成
-- =============================================

-- 1. 特典マスターテーブル
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                      -- 特典名（例: 歯ブラシセット）
  description TEXT,                        -- 詳細説明
  required_stamps INTEGER NOT NULL,        -- 必要なスタンプ数
  image_url TEXT,                          -- 特典画像URL（オプション）
  is_active BOOLEAN DEFAULT true,          -- 有効/無効
  display_order INTEGER DEFAULT 0,         -- 表示順序
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 特典交換履歴テーブル
CREATE TABLE IF NOT EXISTS reward_exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  stamp_count_used INTEGER NOT NULL,       -- 使用したスタンプ数
  exchanged_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending',           -- pending, completed, cancelled
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_rewards_active ON rewards(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_reward_exchanges_user_id ON reward_exchanges(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_exchanges_reward_id ON reward_exchanges(reward_id);
CREATE INDEX IF NOT EXISTS idx_reward_exchanges_status ON reward_exchanges(status);

-- RLS（Row Level Security）設定
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_exchanges ENABLE ROW LEVEL SECURITY;

-- 誰でも特典一覧を読める
CREATE POLICY "allow_public_read_rewards" ON rewards
  FOR SELECT USING (is_active = true);

-- 誰でも交換履歴を読める（自分のもののみ後で制限可能）
CREATE POLICY "allow_public_read_exchanges" ON reward_exchanges
  FOR SELECT USING (true);

-- 誰でも特典交換を登録できる
CREATE POLICY "allow_public_insert_exchanges" ON reward_exchanges
  FOR INSERT WITH CHECK (true);

-- =============================================
-- 初期データ投入（サンプル特典）
-- 積み上げ式：スタンプ数は交換後も減りません
-- =============================================
INSERT INTO rewards (name, description, required_stamps, display_order, is_active) VALUES
  (
    'オリジナル歯ブラシセット',
    '当院推奨の歯ブラシ（ふつう/やわらかめから選択可）とフッ素配合歯磨き粉（30g）をセットでプレゼント。受付でお申し出ください。',
    5,
    1,
    true
  ),
  (
    'フッ素塗布1回無料券',
    '次回来院時にフッ素塗布（通常¥1,100）を無料でご提供。虫歯予防に効果的です。有効期限: 交換日から6ヶ月間',
    10,
    2,
    true
  ),
  (
    '歯のクリーニング50%OFF券',
    'プロフェッショナルクリーニング（PMTC/通常¥5,500）を半額の¥2,750でご提供。歯石除去・着色汚れ除去を含む約30分コース。有効期限: 交換日から3ヶ月間',
    15,
    3,
    true
  ),
  (
    'ホワイトニング1回30%OFF券',
    'オフィスホワイトニング1回コース（通常¥16,500）を30%OFFの¥11,550でご提供。施術時間約60分。有効期限: 交換日から3ヶ月間',
    20,
    4,
    true
  )
ON CONFLICT DO NOTHING;

-- =============================================
-- トリガー関数: updated_at自動更新
-- =============================================
CREATE OR REPLACE FUNCTION update_rewards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_reward_exchanges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー作成
DROP TRIGGER IF EXISTS trigger_update_rewards_updated_at ON rewards;
CREATE TRIGGER trigger_update_rewards_updated_at
BEFORE UPDATE ON rewards
FOR EACH ROW
EXECUTE FUNCTION update_rewards_updated_at();

DROP TRIGGER IF EXISTS trigger_update_reward_exchanges_updated_at ON reward_exchanges;
CREATE TRIGGER trigger_update_reward_exchanges_updated_at
BEFORE UPDATE ON reward_exchanges
FOR EACH ROW
EXECUTE FUNCTION update_reward_exchanges_updated_at();
