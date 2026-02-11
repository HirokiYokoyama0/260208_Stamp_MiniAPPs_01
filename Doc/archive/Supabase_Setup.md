# Supabase セットアップガイド

## データベース設計の重要な判断事項

### `id` カラムの型について

LINEユーザーIDは `U12345...` という形式の文字列で、UUID形式ではありません。
そのため、`id` カラムの型について2つのアプローチがあります。

---

## アプローチ1: シンプル設計（推奨・初期実装向け）

**`id` を TEXT 型にして、LINEのユーザーIDを直接格納する**

### メリット
- シンプルで理解しやすい
- LINE IDをそのまま主キーとして使える
- 追加の変換処理が不要

### デメリット
- 将来的に他の認証方式（Google, メールアドレス等）を追加する際に構造変更が必要
- UUIDを使う一般的なベストプラクティスから外れる

### SQL（アプローチ1）

```sql
-- テーブルの作成（idをTEXT型にし、LINE IDを直接入れる）
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,              -- LINEのユーザーID (Uxxx...) を直接格納
  line_user_id TEXT UNIQUE NOT NULL, -- 冗長だが、将来的な拡張性のため残す
  display_name TEXT,
  picture_url TEXT,
  stamp_count INTEGER DEFAULT 0,    -- スタンプ数
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS（Row Level Security）の設定
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 全員が閲覧可能（将来的に自分のデータのみに制限する場合は修正）
CREATE POLICY "Allow public read access"
  ON profiles FOR SELECT
  USING (true);

-- 全員が挿入可能
CREATE POLICY "Allow public insert"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- 全員が更新可能
CREATE POLICY "Allow public update"
  ON profiles FOR UPDATE
  USING (true);

-- インデックスの追加（検索速度向上）
CREATE INDEX idx_profiles_line_user_id ON profiles(line_user_id);
```

### アプリケーションコード（アプローチ1）

```typescript
// app/page.tsx での保存処理
const { data, error } = await supabase.from("profiles").upsert(
  {
    id: profile.userId,              // LINEのユーザーIDをそのまま使用
    line_user_id: profile.userId,
    display_name: profile.displayName,
    picture_url: profile.pictureUrl,
    updated_at: new Date().toISOString(),
  },
  {
    onConflict: "id",  // idで重複チェック
  }
);
```

---

## アプローチ2: 拡張性重視設計（本格運用向け）

**`id` を UUID 型にして、Supabase Auth連携を前提とする**

### メリット
- Supabaseの認証機能と統合しやすい
- 将来的に複数の認証方式（Google、メール等）に対応可能
- セキュリティが強化される（RLSでauth.uid()を使える）

### デメリット
- 初期実装がやや複雑
- LINE IDとUUIDのマッピング処理が必要

### SQL（アプローチ2）

```sql
-- auth.usersテーブルとの連携を前提としたテーブル
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,  -- Supabase Authと連携
  line_user_id TEXT UNIQUE NOT NULL,
  display_name TEXT,
  picture_url TEXT,
  stamp_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS設定（自分のデータのみアクセス可能）
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- インデックス
CREATE INDEX idx_profiles_line_user_id ON profiles(line_user_id);
```

### アプリケーションコード（アプローチ2）

このアプローチでは、LINEログイン時にSupabase Authに登録し、そのUUIDを使用します。
実装はやや複雑になるため、Phase 2以降で検討することを推奨します。

---

## 推奨：まずはアプローチ1で進める

### 理由
1. **迅速な実装**: 最小限のコードでLINEミニアプリを動作させられる
2. **シンプル**: 初期段階ではLINE認証のみで十分
3. **移行可能**: 後でアプローチ2に移行することも可能

### 実装ステップ

#### ステップ1: Supabase SQL Editorでテーブル作成

上記の「アプローチ1のSQL」をSupabase SQLエディタで実行してください。

#### ステップ2: アプリケーションコードの修正

`app/page.tsx` を以下のように修正：

```typescript
const { data, error } = await supabase.from("profiles").upsert(
  {
    id: profile.userId,              // 追加
    line_user_id: profile.userId,
    display_name: profile.displayName,
    picture_url: profile.pictureUrl,
    updated_at: new Date().toISOString(),
  },
  {
    onConflict: "id",  // line_user_id から id に変更
  }
);
```

#### ステップ3: テスト実行

```bash
npx tsx test/supabase-connection.ts
```

---

## 今後の拡張性について

### Phase 1（現在）: シンプル設計
- アプローチ1を採用
- LINE認証のみ

### Phase 2以降: 拡張可能な設計へ移行
- Supabase Authとの統合
- 複数の認証方式対応
- より厳密なRLS設定

---

## 環境変数の確認

`.env.local` に以下が設定されていることを確認してください：

```env
NEXT_PUBLIC_SUPABASE_URL=https://softoekutwlzivvfzooi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## トラブルシューティング

### エラー: `Could not find the 'picture_url' column`

→ テーブルにカラムが不足しています。上記のSQLを実行してください。

### エラー: `new row for relation "profiles" violates check constraint`

→ RLSポリシーの問題です。アプローチ1のRLSポリシーを再設定してください。

---

## 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-02-08 | 初版作成：id型の2つのアプローチを説明 |
