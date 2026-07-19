-- =====================================
-- reward_exchanges: anon の available→pending 更新を許可（Phase B の前提）
-- =====================================
-- 作成日: 2026-07-19
-- 目的:
--   マイルストーン特典の二重作成を防ぐ「update-not-insert」を LIFF(anon) で機能させる。
--   現状 reward_exchanges は anon の UPDATE ポリシーが無く（003 は SELECT/INSERT のみ・RLS既定拒否）、
--   /api/rewards/exchange の available→pending 更新が 0行になり INSERT にフォールバックしている。
--   （LIFF は設計上 ANON_KEY のみ・service role は使わない = doc 107。だから RLS で許可する。）
--
-- 方針（最小権限）:
--   anon には「available → pending の遷移だけ」を許可する。
--   complete/cancel/expired 等の他遷移や任意更新は許可しない（それらは管理ダッシュボード=service role）。
--
-- ⚠️ 本番適用は Supabase SQL Editor で手動実行すること（repoのSQLは自動適用されない）。
-- ⚠️ 適用順序: 本ポリシー(B前提) → 動作確認 → C(既存クリーンアップ) → D-fix(部分ユニークインデックス)。
-- =====================================

SELECT NOW() AS migration_033_started;

-- 冪等: 既存の同名ポリシーを削除
DROP POLICY IF EXISTS "reward_exchanges_anon_claim_available" ON reward_exchanges;

-- available → pending の遷移のみ許可（anon/authenticated）
CREATE POLICY "reward_exchanges_anon_claim_available"
  ON reward_exchanges FOR UPDATE
  TO anon, authenticated
  USING (
    status = 'available' AND (
      user_id ~ '^U[0-9a-f]{32}$'   -- 本番 LINE User ID
      OR user_id ~ '^U_test_'        -- テスト用
      OR user_id LIKE 'manual-child-%' -- 代理管理メンバー
    )
  )
  WITH CHECK (
    status = 'pending' AND (
      user_id ~ '^U[0-9a-f]{32}$'
      OR user_id ~ '^U_test_'
      OR user_id LIKE 'manual-child-%'
    )
  );

COMMENT ON POLICY "reward_exchanges_anon_claim_available" ON reward_exchanges IS
  'LIFF(anon)が特典を available→pending に更新（交換申請）することのみ許可。complete/cancel等は不可。';

-- 確認
SELECT policyname, cmd, roles, qual AS using_clause, with_check
FROM pg_policies
WHERE tablename = 'reward_exchanges'
ORDER BY cmd, policyname;

SELECT NOW() AS migration_033_completed;

-- =====================================
-- 適用後の期待動作
-- =====================================
-- LIFF /api/rewards/exchange の 8-1 UPDATE（.eq status=available → status=pending）が
--   実際に行を更新し、available取り残しが発生しなくなる（＝update-not-insert が機能）。
-- 検証: available が残っているマイルストーンをアプリで交換 → その行が1行のまま
--   (available→pending)、created_at は元の自動付与日時のまま、
--   ダッシュボードの「同一マイルストーンの重複のため自動キャンセル」兄弟行が出ない。
--
-- 注: スタンプ減少時の invalidateMilestoneRewards（available/pending/completed → cancelled）や
--     期限切れ更新（pending → expired）も anon UPDATE が必要。これらは本ポリシー対象外のため、
--     別途 anon UPDATE 許可を追加するか、管理ダッシュボード(service role)側に寄せるか要判断（doc 106 関連）。
-- =====================================
