-- ============================================
-- つくばホワイト歯科 LINEミニアプリ
-- 公式LINE友だち登録フラグ追加スクリプト
-- ============================================
-- 作成日: 2026-02-09
-- 目的: liff.getFriendship() の結果をキャッシュし、医院側で把握できるようにする
-- ============================================

-- 友だち登録フラグ列を追加
-- ⚠️ 既存データには影響を与えません（既存の列は一切変更しません）
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_line_friend BOOLEAN DEFAULT NULL;

-- インデックスを追加（友だち登録済みユーザーを検索する場合に使用）
CREATE INDEX IF NOT EXISTS idx_profiles_is_line_friend
  ON profiles(is_line_friend)
  WHERE is_line_friend = true;

-- ============================================
-- コメントの追加（ドキュメント化）
-- ============================================

COMMENT ON COLUMN profiles.is_line_friend IS '公式LINE友だち登録状態 (NULL=未確認, true=友だち, false=友だちではない)';

-- ============================================
-- 完了メッセージ
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ is_line_friend 列の追加が完了しました！';
  RAISE NOTICE '📊 列名: is_line_friend (BOOLEAN型、デフォルト: NULL)';
  RAISE NOTICE '🔍 NULL = まだ確認していない';
  RAISE NOTICE '✓ true = 公式LINEの友だち';
  RAISE NOTICE '✗ false = 公式LINEの友だちではない';
  RAISE NOTICE '📌 既存のレコードはすべて NULL として保持されます';
END $$;

-- ============================================
-- 注意事項
-- ============================================

/*
【このマイグレーションの安全性】

1. 既存のカラムは一切変更しません
2. 新しいカラム is_line_friend を追加するのみ
3. デフォルト値は NULL なので、既存データには影響なし
4. NOT NULL 制約はかけていないため、データ不整合は発生しません

【使用方法】

アプリ側で liff.getFriendship() を呼び出した後、
その結果を profiles.is_line_friend に保存します。

例:
```typescript
const friendship = await liff.getFriendship();
await supabase
  .from("profiles")
  .update({ is_line_friend: friendship.friendFlag })
  .eq("id", userId);
```

【メリット】

1. 医院側の管理画面で「友だち登録済みユーザー数」を集計可能
2. 友だち登録していないユーザーに対して、受付でフォローを促せる
3. リマインド通知を送る対象を絞り込める（友だち登録済みのみに通知）

【注意】

- liff.getFriendship() は毎回APIを呼び出すため、頻繁に更新する必要はありません
- 初回ログイン時、または医院情報ページを開いた時に更新することを推奨します
- NULL の場合は「未確認」を意味し、エラーではありません
*/
