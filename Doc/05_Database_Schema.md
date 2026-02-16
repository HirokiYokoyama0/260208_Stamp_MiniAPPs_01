# つくばホワイト歯科 LINEミニアプリ データベーススキーマ

## 📊 概要

このドキュメントでは、Supabase（PostgreSQL）のデータベース構造を全体的にまとめています。

**作成日:** 2026-02-16
**データベース:** Supabase PostgreSQL
**バージョン:** 1.0

---

## 🗂️ テーブル一覧

| テーブル名 | 説明 | マイグレーションファイル |
|-----------|------|------------------------|
| [profiles](#1-profiles-テーブル) | ユーザープロフィール（メインテーブル） | 001_create_profiles_table.sql |
| [stamp_history](#2-stamp_history-テーブル) | スタンプ取得履歴 | 002_create_stamp_history_table.sql |
| [rewards](#3-rewards-テーブル) | 特典マスター | 003_create_rewards_tables.sql |
| [reward_exchanges](#4-reward_exchanges-テーブル) | 特典交換履歴 | 003_create_rewards_tables.sql |

---

## 📐 ER図（エンティティ関連図）

```
┌─────────────────────┐
│     profiles        │ ◄────┐
│─────────────────────│      │
│ id (PK, TEXT)       │      │ 1
│ line_user_id        │      │
│ display_name        │      │
│ picture_url         │      │
│ stamp_count         │      │
│ ticket_number       │      │
│ last_visit_date     │      │
│ is_line_friend      │      │
│ view_mode           │      │
│ next_visit_date     │      │
│ next_memo           │      │
│ next_memo_updated_at│      │
│ reservation_button_ │      │
│   clicks            │      │
│ created_at          │      │
│ updated_at          │      │
└─────────────────────┘      │
                             │
         ┌───────────────────┴───────────────────┐
         │                                       │
         │ N                                     │ N
┌────────┴──────────────┐          ┌────────────┴───────────┐
│   stamp_history       │          │   reward_exchanges     │
│───────────────────────│          │────────────────────────│
│ id (PK, UUID)         │          │ id (PK, UUID)          │
│ user_id (FK)          │          │ user_id (FK)           │
│ visit_date            │          │ reward_id (FK)         │
│ stamp_number          │          │ stamp_count_used       │
│ stamp_method          │          │ exchanged_at           │
│ qr_code_id            │          │ status                 │
│ notes                 │          │ notes                  │
│ created_at            │          │ created_at             │
│ updated_at            │          │ updated_at             │
└───────────────────────┘          └────────────────────────┘
                                                │
                                                │ N
                                                │
                                      ┌─────────┴──────────┐
                                      │     rewards        │
                                      │────────────────────│
                                      │ id (PK, UUID)      │
                                      │ name               │
                                      │ description        │
                                      │ required_stamps    │
                                      │ image_url          │
                                      │ is_active          │
                                      │ display_order      │
                                      │ created_at         │
                                      │ updated_at         │
                                      └────────────────────┘
```

---

## 📋 詳細スキーマ

### 1. `profiles` テーブル

**説明:** ユーザープロフィール情報を管理するメインテーブル

**作成:** `001_create_profiles_table.sql`

| カラム名 | 型 | NULL許可 | デフォルト | 説明 |
|---------|---|---------|----------|------|
| `id` | TEXT | NO | - | **主キー**: LINEユーザーID (Uxxxxxxxxxxxx 形式) |
| `line_user_id` | TEXT | NO | - | LINEユーザーID（冗長だが将来の拡張用） |
| `display_name` | TEXT | YES | - | LINEの表示名 |
| `picture_url` | TEXT | YES | - | LINEプロフィール画像URL |
| `stamp_count` | INTEGER | NO | 0 | 来院スタンプ数（`stamp_history` トリガーで自動更新） |
| `ticket_number` | TEXT | YES | - | 診察券番号（任意） |
| `last_visit_date` | TIMESTAMPTZ | YES | - | 最終来院日時（`stamp_history` トリガーで自動更新） |
| `is_line_friend` | BOOLEAN | YES | NULL | 公式LINE友だち登録状態 (NULL=未確認, true=友だち, false=未登録) |
| `view_mode` | TEXT | NO | 'adult' | 表示モード ('adult' or 'kids') |
| `next_visit_date` | DATE | YES | - | 次回来院予定日 |
| `next_memo` | TEXT | YES | - | ユーザーへの次回メモ（カスタムメッセージ、最大200文字） |
| `next_memo_updated_at` | TIMESTAMPTZ | YES | - | 次回メモの最終更新日時（トリガーで自動更新） |
| `reservation_button_clicks` | INTEGER | NO | 0 | 予約ボタンのクリック回数（累積） |
| `created_at` | TIMESTAMPTZ | NO | NOW() | レコード作成日時 |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | レコード更新日時 |

**インデックス:**
- `idx_profiles_line_user_id` - line_user_id での検索用
- `idx_profiles_last_visit_date` - 最終来院日での検索用（リマインド機能）
- `idx_profiles_is_line_friend` - 友だち登録済みユーザー検索用（部分インデックス）
- `idx_profiles_next_visit_date` - 次回来院予定日での検索用（部分インデックス）
- `idx_profiles_reservation_clicks` - クリック数でのソート・集計用

**制約:**
- PRIMARY KEY: `id`
- UNIQUE: `line_user_id`
- CHECK: `view_mode IN ('adult', 'kids')`

**RLS (Row Level Security):**
- ✅ 有効
- ポリシー: `allow_public_read`, `allow_public_insert`, `allow_public_update` (開発段階)

---

### 2. `stamp_history` テーブル

**説明:** スタンプ取得履歴を記録するテーブル（1ユーザー:N個のスタンプ）

**作成:** `002_create_stamp_history_table.sql`

| カラム名 | 型 | NULL許可 | デフォルト | 説明 |
|---------|---|---------|----------|------|
| `id` | UUID | NO | gen_random_uuid() | **主キー**: 履歴レコードの一意識別子 |
| `user_id` | TEXT | NO | - | **外部キー**: profiles.id へのリンク |
| `visit_date` | TIMESTAMPTZ | NO | - | 実際の来院日時 |
| `stamp_number` | INTEGER | NO | - | **その時点でのスタンプ数（累積）** |
| `stamp_method` | TEXT | NO | 'qr_scan' | 取得方式 ('qr_scan', 'manual_admin', 'import') |
| `qr_code_id` | TEXT | YES | - | QRコードの一意識別子（重複防止用） |
| `notes` | TEXT | YES | - | 管理者による備考（オプション） |
| `created_at` | TIMESTAMPTZ | NO | NOW() | レコード作成日時 |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | レコード更新日時 |

**インデックス:**
- `idx_stamp_history_user_id` - ユーザーごとのスタンプ履歴検索用
- `idx_stamp_history_visit_date` - 来院日時での検索用
- `idx_stamp_history_user_date` - ユーザーID + 来院日時の複合インデックス
- `idx_stamp_history_qr_code_id` - QRコードIDでの検索用（部分インデックス）

**制約:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `user_id` → `profiles(id)` ON DELETE CASCADE

**RLS (Row Level Security):**
- ✅ 有効
- ポリシー: `allow_public_read`, `allow_public_insert` (開発段階)

**トリガー:**
- `trigger_update_profile_stamp_count` (AFTER INSERT)
  - 新しいスタンプが追加されたら `profiles.stamp_count` と `profiles.last_visit_date` を自動更新

**重要な設計ポイント:**
- `stamp_number` は「その時点でのスタンプ数（累積）」を表す
  - 例: 1回目来院 → stamp_number = 1
  - 例: スタッフが「5個に設定」→ stamp_number = 5
- スタンプ数 = `MAX(stamp_number)` （`COUNT(*)` ではない）
- 訪問回数 = `COUNT(*)` （レコード数）

---

### 3. `rewards` テーブル

**説明:** 特典マスター（交換可能な特典の定義）

**作成:** `003_create_rewards_tables.sql`

| カラム名 | 型 | NULL許可 | デフォルト | 説明 |
|---------|---|---------|----------|------|
| `id` | UUID | NO | gen_random_uuid() | **主キー**: 特典の一意識別子 |
| `name` | TEXT | NO | - | 特典名（例: 歯ブラシセット） |
| `description` | TEXT | YES | - | 詳細説明（価格、有効期限、内容詳細） |
| `required_stamps` | INTEGER | NO | - | 必要なスタンプ数 |
| `image_url` | TEXT | YES | - | 特典画像URL（オプション） |
| `is_active` | BOOLEAN | NO | true | 有効/無効フラグ |
| `display_order` | INTEGER | NO | 0 | 表示順序 |
| `created_at` | TIMESTAMPTZ | NO | NOW() | レコード作成日時 |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | レコード更新日時（トリガーで自動更新） |

**インデックス:**
- `idx_rewards_active` - is_active + display_order の複合インデックス

**制約:**
- PRIMARY KEY: `id`

**RLS (Row Level Security):**
- ✅ 有効
- ポリシー: `allow_public_read_rewards` (is_active = true のみ読み取り可能)

**トリガー:**
- `trigger_update_rewards_updated_at` (BEFORE UPDATE)
  - 更新時に `updated_at` を自動更新

**初期データ（サンプル特典）:**

| 特典名 | 必要スタンプ | 詳細 |
|-------|------------|------|
| オリジナル歯ブラシセット | 5個 | 当院推奨の歯ブラシ（ふつう/やわらかめ）とフッ素配合歯磨き粉（30g） |
| フッ素塗布1回無料券 | 10個 | 通常¥1,100 → 無料、有効期限6ヶ月間 |
| 歯のクリーニング50%OFF券 | 15個 | PMTC 通常¥5,500 → ¥2,750、有効期限3ヶ月間 |
| ホワイトニング1回30%OFF券 | 20個 | 通常¥16,500 → ¥11,550、有効期限3ヶ月間 |

---

### 4. `reward_exchanges` テーブル

**説明:** 特典交換履歴（誰がいつどの特典と交換したか）

**作成:** `003_create_rewards_tables.sql`

| カラム名 | 型 | NULL許可 | デフォルト | 説明 |
|---------|---|---------|----------|------|
| `id` | UUID | NO | gen_random_uuid() | **主キー**: 交換履歴の一意識別子 |
| `user_id` | TEXT | NO | - | **外部キー**: profiles.id へのリンク |
| `reward_id` | UUID | NO | - | **外部キー**: rewards.id へのリンク |
| `stamp_count_used` | INTEGER | NO | - | 使用したスタンプ数（参考値、積み上げ式なので実際は減らない） |
| `exchanged_at` | TIMESTAMPTZ | NO | NOW() | 交換日時 |
| `status` | TEXT | NO | 'pending' | ステータス ('pending', 'completed', 'cancelled') |
| `notes` | TEXT | YES | - | 管理者による備考 |
| `created_at` | TIMESTAMPTZ | NO | NOW() | レコード作成日時 |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | レコード更新日時（トリガーで自動更新） |

**インデックス:**
- `idx_reward_exchanges_user_id` - ユーザーごとの交換履歴検索用
- `idx_reward_exchanges_reward_id` - 特典ごとの交換履歴検索用
- `idx_reward_exchanges_status` - ステータスでの検索用

**制約:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `user_id` → `profiles(id)` ON DELETE CASCADE
- FOREIGN KEY: `reward_id` → `rewards(id)` ON DELETE CASCADE

**RLS (Row Level Security):**
- ✅ 有効
- ポリシー: `allow_public_read_exchanges`, `allow_public_insert_exchanges` (開発段階)

**トリガー:**
- `trigger_update_reward_exchanges_updated_at` (BEFORE UPDATE)
  - 更新時に `updated_at` を自動更新

**ステータス管理:**

| ステータス | 意味 | 運用 |
|-----------|------|------|
| `pending` | 交換申請済み | 受付で特典を提供する前 |
| `completed` | 提供完了 | 受付で実際に特典を渡した後 |
| `cancelled` | キャンセル | 誤交換などの取り消し |

---

## 🔧 データベース関数

### 1. `update_profile_stamp_count()`

**説明:** スタンプ履歴が追加されたら profiles テーブルを自動更新

**作成:** `002_create_stamp_history_table.sql`

**トリガー:** `trigger_update_profile_stamp_count` (AFTER INSERT on stamp_history)

**処理内容:**
```sql
-- stamp_count を MAX(stamp_number) で更新
-- last_visit_date を MAX(visit_date) で更新
-- updated_at を NOW() で更新
```

**設計原則: Single Source of Truth**
- `profiles.stamp_count` がスタンプ数の唯一の真実
- 手動で更新する必要なし（トリガーが自動計算）

---

### 2. `update_next_memo_timestamp()`

**説明:** 次回メモが変更されたら next_memo_updated_at を自動更新

**作成:** `006_add_next_memo_columns.sql`

**トリガー:** `trigger_update_next_memo_timestamp` (BEFORE UPDATE on profiles)

**処理内容:**
```sql
-- next_visit_date または next_memo が変更された場合のみ
-- next_memo_updated_at を NOW() で更新
```

---

### 3. `increment_reservation_clicks(p_user_id TEXT)`

**説明:** 予約ボタンのクリック数を安全に +1 する

**作成:** `007_add_reservation_clicks.sql`

**戻り値:** INTEGER (更新後のクリック数)

**処理内容:**
```sql
-- profiles.reservation_button_clicks を COALESCE(現在値, 0) + 1 で更新
-- RETURNING 句で更新後の値を取得
-- ユーザーが存在しない場合は 0 を返す
```

**利点:**
- 排他制御付き（複数リクエストが同時に来ても正しくカウント）
- NULL 安全（NULL の場合も 0 として扱う）
- パフォーマンス（1回のクエリで完結）

---

### 4. `update_rewards_updated_at()`

**説明:** rewards テーブルの updated_at を自動更新

**作成:** `003_create_rewards_tables.sql`

**トリガー:** `trigger_update_rewards_updated_at` (BEFORE UPDATE on rewards)

---

### 5. `update_reward_exchanges_updated_at()`

**説明:** reward_exchanges テーブルの updated_at を自動更新

**作成:** `003_create_rewards_tables.sql`

**トリガー:** `trigger_update_reward_exchanges_updated_at` (BEFORE UPDATE on reward_exchanges)

---

## 📊 データフロー図

### スタンプ登録フロー

```
1. ユーザーがQRコードをスキャン
   ↓
2. POST /api/stamps
   ↓
3. stamp_history にレコード INSERT
   ↓
4. トリガー発火: update_profile_stamp_count()
   ↓
5. profiles.stamp_count が自動更新（MAX(stamp_number)）
   ↓
6. profiles.last_visit_date が自動更新（MAX(visit_date)）
   ↓
7. レスポンス返却
```

### 特典交換フロー（積み上げ式）

```
1. ユーザーが特典交換ボタンをタップ
   ↓
2. POST /api/rewards/exchange
   ↓
3. スタンプ数チェック（profiles.stamp_count >= required_stamps）
   ↓
4. reward_exchanges にレコード INSERT
   ↓
5. profiles.stamp_count は減らさない（積み上げ式）
   ↓
6. レスポンス返却
```

### 次回メモ更新フロー

```
1. 受付スタッフが /admin/memo にアクセス
   ↓
2. ユーザーIDを入力、次回予約日・メッセージを設定
   ↓
3. PUT /api/users/[userId]/memo
   ↓
4. profiles.next_visit_date と next_memo を UPDATE
   ↓
5. トリガー発火: update_next_memo_timestamp()
   ↓
6. profiles.next_memo_updated_at が自動更新
   ↓
7. 患者のLINEミニアプリに即座に反映
```

### 予約ボタンクリックフロー

```
1. ユーザーが「予約する」ボタンをタップ
   ↓
2. 診察券番号をコピー + アポツールを開く
   ↓
3. 非同期で POST /api/users/[userId]/reservation-click
   ↓
4. supabase.rpc('increment_reservation_clicks', { p_user_id })
   ↓
5. profiles.reservation_button_clicks が +1
   ↓
6. エラーでもユーザー体験は妨げない（.catch() で握りつぶし）
```

---

## 🔐 セキュリティ設定

### Row Level Security (RLS)

**現在の設定（開発段階）:**
- 全てのテーブルでRLS有効
- 全員が読み取り・挿入・更新可能（`allow_public_*` ポリシー）

**本番環境での推奨設定:**

```sql
-- プロフィールは自分のデータのみ更新可能
CREATE POLICY "user_update_own_profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- スタンプ履歴は自分のデータのみ閲覧可能
CREATE POLICY "user_read_own_stamps"
  ON stamp_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- 特典交換履歴は自分のデータのみ閲覧可能
CREATE POLICY "user_read_own_exchanges"
  ON reward_exchanges
  FOR SELECT
  USING (auth.uid() = user_id);
```

---

## 📈 統計クエリ例

### 全ユーザーのスタンプ数ランキング

```sql
SELECT
  display_name AS 患者名,
  ticket_number AS 診察券番号,
  stamp_count AS スタンプ数,
  last_visit_date AS 最終来院日
FROM profiles
ORDER BY stamp_count DESC
LIMIT 10;
```

### 友だち登録率

```sql
SELECT
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE is_line_friend = true) / COUNT(*),
    2
  ) AS friend_rate_percent
FROM profiles;
```

### 特典交換ランキング

```sql
SELECT
  r.name AS 特典名,
  COUNT(*) AS 交換回数
FROM reward_exchanges re
JOIN rewards r ON re.reward_id = r.id
WHERE re.status = 'completed'
GROUP BY r.name
ORDER BY COUNT(*) DESC;
```

### 予約ボタンクリック数トップ10

```sql
SELECT
  display_name AS 患者名,
  ticket_number AS 診察券番号,
  reservation_button_clicks AS クリック数,
  stamp_count AS スタンプ数
FROM profiles
WHERE reservation_button_clicks > 0
ORDER BY reservation_button_clicks DESC
LIMIT 10;
```

### スタンプ数とクリック数の相関

```sql
SELECT
  stamp_count AS スタンプ数,
  AVG(reservation_button_clicks) AS 平均クリック数
FROM profiles
WHERE stamp_count > 0
GROUP BY stamp_count
ORDER BY stamp_count;
```

---

## 🚀 マイグレーション実行順序

データベースをゼロから構築する場合、以下の順序でSQLファイルを実行してください。

| 順序 | ファイル名 | 説明 |
|-----|-----------|------|
| 1 | `001_create_profiles_table.sql` | プロフィールテーブル作成 |
| 2 | `002_create_stamp_history_table.sql` | スタンプ履歴テーブル + トリガー作成 |
| 3 | `003_create_rewards_tables.sql` | 特典システムテーブル + 初期データ |
| 4 | `004_add_is_line_friend_column.sql` | 友だち登録フラグ追加 |
| 5 | `005_add_view_mode_column.sql` | 表示モードカラム追加 |
| 6 | `006_add_next_memo_columns.sql` | 次回メモ機能カラム + トリガー追加 |
| 7 | `007_add_reservation_clicks.sql` | 予約ボタンクリック数カラム + 関数追加 |

**注意:**
- 002 は 001 に依存（外部キー: profiles.id）
- 003 は 001 に依存（外部キー: profiles.id）
- 004〜007 は 001 に依存（profiles テーブルへのカラム追加）

---

## 📝 データ整合性チェック

### スタンプ数の整合性チェック

```sql
-- profiles.stamp_count と stamp_history の MAX(stamp_number) が一致するか確認
SELECT
  p.id AS user_id,
  p.stamp_count AS profile_stamp_count,
  COALESCE(MAX(sh.stamp_number), 0) AS history_max_stamp_number,
  CASE
    WHEN p.stamp_count = COALESCE(MAX(sh.stamp_number), 0) THEN '✅ 一致'
    ELSE '❌ 不一致'
  END AS status
FROM profiles p
LEFT JOIN stamp_history sh ON p.id = sh.user_id
GROUP BY p.id, p.stamp_count
HAVING p.stamp_count != COALESCE(MAX(sh.stamp_number), 0);
```

### 最終来院日の整合性チェック

```sql
-- profiles.last_visit_date と stamp_history の MAX(visit_date) が一致するか確認
SELECT
  p.id AS user_id,
  p.last_visit_date AS profile_last_visit,
  MAX(sh.visit_date) AS history_max_visit,
  CASE
    WHEN p.last_visit_date = MAX(sh.visit_date) THEN '✅ 一致'
    ELSE '❌ 不一致'
  END AS status
FROM profiles p
LEFT JOIN stamp_history sh ON p.id = sh.user_id
GROUP BY p.id, p.last_visit_date
HAVING p.last_visit_date != MAX(sh.visit_date);
```

---

## ⚠️ よくある問題と対処法

### 問題1: スタンプ数が正しくない

**原因:**
- トリガー関数が `COUNT(*)` を使っている（訪問回数を数えている）
- 正しくは `MAX(stamp_number)` を使う必要がある

**対処:**
```sql
-- トリガー関数を修正
CREATE OR REPLACE FUNCTION update_profile_stamp_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET stamp_count = (
    SELECT COALESCE(MAX(stamp_number), 0)  -- ← MAX を使用
    FROM stamp_history
    WHERE user_id = NEW.user_id
  )
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 問題2: トリガーが動作しない

**原因:**
- トリガーが正しく作成されていない
- トリガー関数のエラー

**対処:**
```sql
-- トリガーの存在確認
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_profile_stamp_count';

-- トリガーを再作成
DROP TRIGGER IF EXISTS trigger_update_profile_stamp_count ON stamp_history;
CREATE TRIGGER trigger_update_profile_stamp_count
AFTER INSERT ON stamp_history
FOR EACH ROW
EXECUTE FUNCTION update_profile_stamp_count();
```

### 問題3: RLSポリシーでアクセスできない

**原因:**
- RLSポリシーが厳しすぎる

**対処（開発環境のみ）:**
```sql
-- 一時的にRLSを無効化（開発環境のみ）
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- または全員アクセス可能にする
DROP POLICY IF EXISTS "allow_public_read" ON profiles;
CREATE POLICY "allow_public_read" ON profiles FOR SELECT USING (true);
```

---

## 📚 関連ドキュメント

- [機能仕様書](03_機能仕様書.md) - 各機能の詳細仕様
- [TODO](10_TODO.md) - タスク管理
- [実装履歴](90_実装履歴.md) - 日次の実装内容
- [仕様変更履歴](91_仕様変更履歴.md) - 重要な仕様変更

---

## 改訂履歴

| 日付 | バージョン | 内容 |
|------|----------|------|
| 2026-02-16 | 1.0 | 初版作成：全テーブル・関数・トリガーを統合したスキーマドキュメント |

---

**作成者:** Claude Code
**最終更新日:** 2026-02-16
