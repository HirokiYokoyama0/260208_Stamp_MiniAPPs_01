-- ============================================
-- つくばホワイト歯科 LINEミニアプリ
-- 表示モード（大人用/子供用）カラム追加スクリプト
-- ============================================
-- 作成日: 2026-02-11
-- 目的: ユーザーごとに大人用/子供用の表示モードを保存する
-- ============================================

-- view_mode 列を追加
-- 既存データには影響を与えません（デフォルト 'adult' が適用されます）
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS view_mode TEXT DEFAULT 'adult'
CHECK (view_mode IN ('adult', 'kids'));

-- ============================================
-- コメントの追加（ドキュメント化）
-- ============================================

COMMENT ON COLUMN profiles.view_mode IS '表示モード: adult（大人用）/ kids（子供用）';

-- ============================================
-- 完了メッセージ
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'view_mode 列の追加が完了しました';
  RAISE NOTICE '列名: view_mode (TEXT型、デフォルト: adult)';
  RAISE NOTICE 'adult = 大人用モード（デフォルト）';
  RAISE NOTICE 'kids = 子供用モード';
  RAISE NOTICE '既存のレコードはすべて adult として保持されます';
END $$;

-- ============================================
-- 注意事項
-- ============================================

/*
【このマイグレーションの安全性】

1. 既存のカラムは一切変更しません
2. 新しいカラム view_mode を追加するのみ
3. デフォルト値は 'adult' なので、既存ユーザーは大人用のまま
4. CHECK制約で 'adult' と 'kids' のみ許可

【既存データへの影響】

- 既存ユーザー -> view_mode = 'adult'（デフォルト値が自動適用）
- 新規ユーザー -> view_mode = 'adult'（デフォルト値）
- マイグレーション不要（カラム追加のみ）

【使用方法】

アプリの設定ページでユーザーがモードを切り替えた際に更新します。

例:
  await supabase
    .from('profiles')
    .update({ view_mode: 'kids', updated_at: new Date().toISOString() })
    .eq('id', userId);

取得:
  const { data } = await supabase
    .from('profiles')
    .select('view_mode')
    .eq('id', userId)
    .single();
  -- data.view_mode -> 'adult' or 'kids'
*/
