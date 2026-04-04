-- マイグレーション: reward_exchanges.status に 'available' ステータスを追加
-- 作成日: 2026-04-04
-- 目的: マイルストーン到達時の初期ステータスとして 'available' を使用可能にする

-- 既存のCHECK制約を削除
ALTER TABLE reward_exchanges
DROP CONSTRAINT IF EXISTS reward_exchanges_status_check;

-- 新しいCHECK制約を追加（'available'を含む）
ALTER TABLE reward_exchanges
ADD CONSTRAINT reward_exchanges_status_check
CHECK (status IN ('available', 'pending', 'completed', 'cancelled', 'expired'));

-- 確認用コメント
COMMENT ON CONSTRAINT reward_exchanges_status_check ON reward_exchanges IS
'Status values: available (milestone reached), pending (user requested), completed (provided), cancelled, expired';
