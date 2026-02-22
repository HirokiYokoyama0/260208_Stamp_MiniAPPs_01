-- ========================================
-- マイグレーション: 10倍整数システム対応
-- ファイル: 008_add_10x_system_columns.sql
-- 作成日: 2026-02-16
-- ========================================
--
-- 【目的】
-- 将来のスロットゲーム対応のため、スタンプ管理を10倍単位に変更
-- - 内部値: 10点 = スタンプ1個
-- - 通常来院: +10点
-- - スロット当選: +3〜8点
--
-- 【変更内容】
-- 1. profiles テーブルに visit_count カラム追加（純粋な来院回数）
-- 2. stamp_history テーブルに amount カラム追加（今回付与したポイント）
-- 3. トリガー関数を更新（visit_count の自動計算）
-- 4. コメントを追加（将来の理解のため）
--
-- ========================================

-- ① profiles テーブルに visit_count カラム追加
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS visit_count INTEGER DEFAULT 0;

COMMENT ON COLUMN profiles.visit_count IS '純粋な来院回数（スロット除く通院のみカウント）';

-- ② stamp_history テーブルに amount カラム追加
ALTER TABLE stamp_history
  ADD COLUMN IF NOT EXISTS amount INTEGER NOT NULL DEFAULT 10;

COMMENT ON COLUMN stamp_history.amount IS '今回付与したポイント（通常来院=10、スロット=3〜8）';

-- ③ 既存データの amount を10に設定（既存のレコードは全て通常来院として扱う）
UPDATE stamp_history
SET amount = 10
WHERE amount IS NULL;

-- ④ 既存データの visit_count を計算
-- 注: 既存データは全て amount = 10（通常来院）なので、レコード数をカウント
UPDATE profiles p
SET visit_count = (
  SELECT COUNT(*)
  FROM stamp_history
  WHERE user_id = p.id
);

-- ⑤ トリガー関数を更新（visit_count の自動計算を追加）
CREATE OR REPLACE FUNCTION update_profile_stamp_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET
    -- 累積スタンプ数 = MAX(stamp_number)
    stamp_count = (
      SELECT COALESCE(MAX(stamp_number), 0)
      FROM stamp_history
      WHERE user_id = NEW.user_id
    ),
    -- 来院回数 = amount が 10 のレコード数（通常来院のみカウント）
    visit_count = (
      SELECT COUNT(*)
      FROM stamp_history
      WHERE user_id = NEW.user_id AND amount = 10
    ),
    -- 最終来院日 = MAX(visit_date)
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

-- トリガーは既存のものを使用（AFTER INSERT on stamp_history）

-- ⑥ コメントを更新（将来の理解のため）
COMMENT ON COLUMN profiles.stamp_count IS '累積ポイント（内部単位: 10点 = スタンプ1個、現在は1点=1スタンプだが将来×10する予定）';
COMMENT ON COLUMN stamp_history.stamp_number IS '付与後の累積ポイント（現在は1点=1スタンプだが将来×10する予定）';

-- ========================================
-- マイグレーション完了
-- ========================================
--
-- 【確認SQL】
-- -- visit_count の確認
-- SELECT id, display_name, stamp_count, visit_count
-- FROM profiles
-- ORDER BY stamp_count DESC;
--
-- -- amount の確認
-- SELECT user_id, visit_date, stamp_number, amount
-- FROM stamp_history
-- ORDER BY visit_date DESC
-- LIMIT 10;
--