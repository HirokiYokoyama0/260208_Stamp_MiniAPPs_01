# Supabase セットアップ手順

## 📋 実施するべき手順

以下の手順でSupabaseのデータベースを設定してください。

---

## ステップ1: Supabase SQL Editorを開く

1. [Supabase Dashboard](https://app.supabase.com/) にアクセス
2. プロジェクト「TsukubaDental」を選択
3. 左サイドバーの「SQL Editor」をクリック

---

## ステップ2: テーブル作成SQLを実行

以下のSQLをコピーして、SQL Editorに貼り付けて実行してください。

### 📄 実行するSQL

```sql
-- ============================================
-- つくばホワイト歯科 LINEミニアプリ
-- プロファイルテーブル作成スクリプト
-- ============================================

-- プロファイルテーブルの作成
CREATE TABLE IF NOT EXISTS profiles (
  -- 主キー: LINEのユーザーID (Uxxxxxxxxxxxx 形式) を直接格納
  id TEXT PRIMARY KEY,

  -- LINEユーザーID（冗長だが将来の拡張性のため保持）
  line_user_id TEXT UNIQUE NOT NULL,

  -- ユーザー表示名
  display_name TEXT,

  -- プロフィール画像URL
  picture_url TEXT,

  -- スタンプ数（来院回数）
  stamp_count INTEGER DEFAULT 0,

  -- 診察券番号（任意）
  ticket_number TEXT,

  -- 最終来院日
  last_visit_date TIMESTAMPTZ,

  -- 作成日時
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 更新日時
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- インデックスの作成
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_line_user_id
  ON profiles(line_user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_last_visit_date
  ON profiles(last_visit_date);

-- ============================================
-- Row Level Security (RLS) の設定
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_public_read"
  ON profiles
  FOR SELECT
  USING (true);

CREATE POLICY "allow_public_insert"
  ON profiles
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "allow_public_update"
  ON profiles
  FOR UPDATE
  USING (true);
```

### 実行方法
1. 上記のSQLをすべてコピー
2. SQL Editorに貼り付け
3. 右下の「Run」ボタンをクリック
4. 「Success」と表示されればOK！

---

## ステップ3: テーブル作成を確認

### 方法1: Table Editorで確認
1. 左サイドバーの「Table Editor」をクリック
2. `profiles` テーブルが表示されていればOK

### 方法2: SQLで確認
SQL Editorで以下を実行：

```sql
SELECT * FROM profiles LIMIT 5;
```

結果が表示されれば（データが0件でも）、テーブルが正常に作成されています。

---

## ステップ4: 接続テストを実行

ローカル開発環境で接続テストを実行します。

```bash
npx tsx test/supabase-connection.ts
```

### 期待される結果

```
===========================================
🧪 Supabase 接続テスト
===========================================

📋 環境変数チェック:
  NEXT_PUBLIC_SUPABASE_URL: ✅ 設定済み
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ✅ 設定済み

🔌 接続テスト中...

📊 テスト1: データベース接続確認
  ✅ データベース接続成功！

📝 テスト2: テストデータの挿入
  ✅ テストデータの挿入成功！

📖 テスト3: データの取得
  ✅ データの取得成功！

✏️  テスト4: データの更新（UPSERT）
  ✅ データの更新成功！

🗑️  テスト5: テストデータの削除
  ✅ テストデータの削除成功！

===========================================
🎉 すべてのテストが完了しました！
===========================================
```

---

## ステップ5: アプリケーションを起動してテスト

### 5-1. 開発サーバーを起動

```bash
npm run dev
```

### 5-2. ブラウザでアクセス

http://localhost:3000 （またはポート番号が異なる場合は表示されたURL）

### 5-3. 動作確認

1. **LINEログイン**を実行
2. ブラウザの開発者ツール（F12）を開く
3. コンソールに以下のメッセージが表示されればOK：

```
✅ ユーザー情報をDBに保存しました: {userId: "Uxxxx...", displayName: "あなたの名前"}
```

### 5-4. Supabaseでデータを確認

1. Supabase Dashboardの「Table Editor」を開く
2. `profiles` テーブルを選択
3. あなたのLINEユーザー情報が保存されていることを確認

---

## トラブルシューティング

### ❌ エラー: `relation "profiles" does not exist`

→ ステップ2のSQLが実行されていません。もう一度SQL Editorで実行してください。

### ❌ エラー: `Could not find the 'picture_url' column`

→ テーブルに必要なカラムが不足しています。以下のSQLを実行：

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS picture_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS stamp_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ticket_number TEXT,
  ADD COLUMN IF NOT EXISTS last_visit_date TIMESTAMPTZ;
```

### ❌ エラー: `new row violates row-level security policy`

→ RLSポリシーの問題です。以下のSQLで修正：

```sql
-- 既存のポリシーを削除
DROP POLICY IF EXISTS "allow_public_read" ON profiles;
DROP POLICY IF EXISTS "allow_public_insert" ON profiles;
DROP POLICY IF EXISTS "allow_public_update" ON profiles;

-- 新しいポリシーを作成
CREATE POLICY "allow_public_read"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "allow_public_insert"
  ON profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_public_update"
  ON profiles FOR UPDATE USING (true);
```

### ⚠️ 環境変数が設定されていない

`.env.local` ファイルを確認してください：

```env
NEXT_PUBLIC_SUPABASE_URL=https://softoekutwlzivvfzooi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 完了チェックリスト

実施できたらチェックを入れてください：

- [ ] Supabase SQL Editorでテーブル作成SQLを実行
- [ ] Table Editorで `profiles` テーブルが表示されることを確認
- [ ] `npx tsx test/supabase-connection.ts` でテストが成功
- [ ] 開発サーバーを起動
- [ ] LINEログインを実行
- [ ] コンソールに「✅ ユーザー情報をDBに保存しました」と表示
- [ ] Supabase Table Editorで自分のデータが保存されていることを確認

すべてチェックできたら、Supabaseセットアップ完了です！🎉

---

## 参考: テーブル構造

| カラム名 | 型 | 説明 |
|---------|---|------|
| `id` | TEXT | 主キー（LINEユーザーID） |
| `line_user_id` | TEXT | LINEユーザーID（冗長だが将来用） |
| `display_name` | TEXT | LINEの表示名 |
| `picture_url` | TEXT | プロフィール画像URL |
| `stamp_count` | INTEGER | スタンプ数（来院回数） |
| `ticket_number` | TEXT | 診察券番号（任意） |
| `last_visit_date` | TIMESTAMPTZ | 最終来院日 |
| `created_at` | TIMESTAMPTZ | 作成日時 |
| `updated_at` | TIMESTAMPTZ | 更新日時 |

---

## 次のステップ

✅ Supabaseセットアップが完了したら、次は以下の機能を実装します：

1. **スタンプ機能の実装**（Phase 2）
2. **ケア記録機能の実装**（Phase 3）
3. **管理ダッシュボードの構築**（Phase 7）

詳細は [TODO.md](TODO.md) を参照してください。
