-- マイグレーション: 既存のマイルストーン特典を 'pending' から 'available' に更新
-- 作成日: 2026-04-04
-- 目的: 誤って 'pending' で作成されたマイルストーン特典を正しい初期ステータスに修正

-- 注意: このマイグレーションは028_add_available_status.sql の後に実行すること

-- 既存のマイルストーン特典で pending 状態のものを available に更新
-- 条件:
--   1. is_milestone_based = true (マイルストーン特典)
--   2. status = 'pending' (誤って pending で作成された)
--   3. 実際にユーザーが「交換する」ボタンを押していないもの
--      (判定: 作成日時が最近で、まだ受付で処理されていないもの)

UPDATE reward_exchanges
SET
  status = 'available',
  notes = COALESCE(notes || ' ', '') || '【修正】初期ステータスをavailableに変更',
  updated_at = NOW()
WHERE
  is_milestone_based = true
  AND status = 'pending';

-- 更新件数を確認
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ % 件のマイルストーン特典を pending → available に更新しました', updated_count;
END $$;
