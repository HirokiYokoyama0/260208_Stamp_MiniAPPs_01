-- ========================================
-- reward_exchanges.reward_id の外部キー制約を修正
-- ファイル: 024_fix_reward_id_foreign_key.sql
-- 作成日: 2026-03-27
-- 問題: reward_id が rewards テーブルのみを参照しているため、
--       milestone_rewards のIDを使うとエラーになる
-- ========================================

-- Step 1: 既存の外部キー制約を削除
ALTER TABLE reward_exchanges
DROP CONSTRAINT IF EXISTS reward_exchanges_reward_id_fkey;

-- Step 2: reward_idに対する制約を削除（milestone_rewardsも許可するため）
-- 注意: 外部キーなしにするのでアプリケーション側で整合性を保つ必要がある
-- または、reward_idとは別にmilestone_reward_idカラムを追加する方法もある

-- 確認: どちらの方法を取るか
-- 方法A: 外部キー制約なし（アプリケーション側で制御）
-- 方法B: milestone_reward_idカラムを追加

-- ========================================
-- 方法A: 外部キー制約なし（推奨: シンプル）
-- ========================================

-- 既にStep 1で削除済み
-- rewardIdには rewards.id または milestone_rewards.id が入る
-- is_milestone_based フラグで区別

COMMENT ON COLUMN reward_exchanges.reward_id IS '特典ID: rewardsテーブルまたはmilestone_rewardsテーブルのID（is_milestone_basedで区別）';

-- ========================================
-- 確認クエリ
-- ========================================

-- 制約の確認
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'reward_exchanges'::regclass
  AND conname LIKE '%reward_id%';

-- ========================================
-- マイグレーション完了
-- ========================================
