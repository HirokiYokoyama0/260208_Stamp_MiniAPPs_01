# つくばホワイト歯科 LINEミニアプリ データベーススキーマ

## 📊 概要

このドキュメントでは、Supabase（PostgreSQL）のデータベース構造を全体的にまとめています。

**作成日:** 2026-02-16
**最終更新:** 2026-04-04
**データベース:** Supabase PostgreSQL
**バージョン:** 1.8 (RLSセキュリティ強化・本番環境適用済み)

---

## 🗂️ テーブル一覧

| テーブル名 | 説明 | マイグレーションファイル |
|-----------|------|------------------------|
| [profiles](#1-profiles-テーブル) | ユーザープロフィール（メインテーブル） | 001_create_profiles_table.sql |
| [stamp_history](#2-stamp_history-テーブル) | スタンプ取得履歴 | 002_create_stamp_history_table.sql |
| [families](#3-families-テーブル) | 家族グループ（Phase 2） | 009_add_family_support.sql |
| [rewards](#4-rewards-テーブル) | 特典マスター（旧仕様・未使用） | 003_create_rewards_tables.sql |
| [milestone_rewards](#4b-milestone_rewards-テーブル) | **マイルストーン型特典マスター（新仕様）** | 021_milestone_rewards_migration.sql |
| [reward_exchanges](#5-reward_exchanges-テーブル) | 特典交換履歴（新旧両対応） | 003_create_rewards_tables.sql + 021 |
| [milestone_history](#5b-milestone_history-テーブル) | **マイルストーン到達履歴** | 021_milestone_rewards_migration.sql |
| [activity_logs](#7-activity_logs-テーブル) | スタッフ操作ログ（監査用） | 014_create_activity_logs_table.sql |
| [event_logs](#8-event_logs-テーブル) | ユーザー行動ログ（分析用） | 015_create_event_logs_table_ForUser.sql |
| [staff](#9-staff-テーブル) | スタッフアカウント | 013_create_staff_table.sql |
| [patient_dental_records](#10-patient_dental_records-テーブル) | 歯科ケア記録（Phase 3） | 019_create_dental_records_table.sql |

**ビュー:**
| ビュー名 | 説明 | マイグレーションファイル |
|---------|------|------------------------|
| [family_stamp_totals](#6-family_stamp_totals-ビュー) | 家族ごとのスタンプ合計 | 009_add_family_support.sql |
| daily_active_users | 日別アクティブユーザー数 | 015_create_event_logs_table_ForUser.sql |
| event_summary | イベント別集計（直近30日） | 015_create_event_logs_table_ForUser.sql |

---

## 📐 ER図（エンティティ関連図）

```
                    ┌─────────────────────┐
         ┌─────────►│     families        │◄──────┐
         │          │─────────────────────│       │
         │ N        │ id (PK, TEXT/UUID)  │       │ 1
         │          │ family_name         │       │
         │          │ representative_     │       │
         │          │   user_id (FK)      │───────┘
         │          │ created_at          │
         │          │ updated_at          │
         │          └─────────────────────┘
         │ FK                    │
         │                       │ 1
         │                       │
         │                       ▼ Aggregated by
         │          ┌─────────────────────────────┐
         │          │  family_stamp_totals (VIEW) │
         │          │─────────────────────────────│
         │          │ family_id                   │
         │          │ family_name                 │
         │          │ total_stamp_count           │
         │          │ total_visit_count           │
         │          │ member_count                │
         │          │ ...                         │
         │          └─────────────────────────────┘
         │
┌────────┴──────────────┐
│     profiles          │ ◄────┐
│───────────────────────│      │
│ id (PK, TEXT)         │      │ 1
│ line_user_id          │      │
│ display_name          │      │
│ real_name             │      │
│ picture_url           │      │
│ stamp_count           │      │
│ visit_count           │      │
│ family_id (FK)        │──────┘ (循環参照)
│ family_role           │
│ ticket_number         │
│ last_visit_date       │
│ is_line_friend        │
│ view_mode             │
│ next_visit_date       │
│ next_memo             │
│ next_memo_updated_at  │
│ reservation_button_   │
│   clicks              │
│ created_at            │
│ updated_at            │
└───────────────────────┘
         │ 1
         ├───────────────────┬───────────────────┐
         │ N                 │ N                 │
         │                   │                   │
         ▼                   ▼                   │
┌────────────────────┐  ┌──────────────────┐   │
│  stamp_history     │  │reward_exchanges  │   │
│────────────────────│  │──────────────────│   │
│ id (PK, UUID)      │  │ id (PK, UUID)    │   │
│ user_id (FK)       │  │ user_id (FK)     │   │
│ visit_date         │  │ reward_id (FK)   │───┐
│ stamp_number       │  │ stamp_count_used │   │
│ amount             │  │ exchanged_at     │   │
│ stamp_method       │  │ status           │   │
│ qr_code_id         │  │ notes            │   │
│ notes              │  │ created_at       │   │
│ created_at         │  │ updated_at       │   │
│ updated_at         │  └──────────────────┘   │ N
└────────────────────┘              │           │
                                    │ 1         ▼
                          ┌─────────┴──────────────┐
                          │     rewards            │
                          │────────────────────────│
                          │ id (PK, UUID)          │
                          │ name                   │
                          │ description            │
                          │ required_stamps        │
                          │ image_url              │
                          │ is_active              │
                          │ display_order          │
                          │ created_at             │
                          │ updated_at             │
                          └────────────────────────┘
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
| `real_name` | TEXT | YES | - | 患者の本名（管理画面専用、個人情報、Phase 2で追加） |
| `picture_url` | TEXT | YES | - | LINEプロフィール画像URL |
| `stamp_count` | INTEGER | NO | 0 | 累積スタンプ数（`stamp_history` トリガーで自動更新） |
| `visit_count` | INTEGER | NO | 0 | 純粋な来院回数（通常来院のみカウント、トリガーで自動更新） |
| `family_id` | TEXT | YES | - | 所属する家族のID（FK → `families.id`、Phase 2で追加） |
| `family_role` | TEXT | YES | - | 家族内の役割（'parent' or 'child'、Phase 2で追加） |
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
- `idx_profiles_real_name` - 本名での検索用（部分インデックス、Phase 2で追加）

**制約:**
- PRIMARY KEY: `id`
- UNIQUE: `line_user_id`
- CHECK: `view_mode IN ('adult', 'kids')`
- CHECK: `family_role IN ('parent', 'child')`
- FOREIGN KEY: `family_id` → `families(id)` ON DELETE SET NULL

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
| `stamp_number` | INTEGER | NO | - | **付与後の累積スタンプ数** |
| `amount` | INTEGER | NO | 1 | **今回付与したスタンプ数**（通常は1、将来的にスロットゲーム等で可変になる可能性あり） |
| `stamp_method` | TEXT | NO | 'qr_scan' | 取得方式 ('qr_scan', 'manual_admin', 'import', 'survey_reward') |
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
- ポリシー:
  - `allow_public_read` - 全員が読み取り可能
  - `allow_public_insert` - 全員が挿入可能
  - `allow_public_delete` - 全員が削除可能（016マイグレーションで追加、2026-02-24）
  - `allow_public_update` - 全員が更新可能（016マイグレーションで追加、2026-02-24）

**トリガー:**
- `trigger_update_profile_stamp_count` (AFTER INSERT)
  - 新しいスタンプが追加されたら `profiles.stamp_count` と `profiles.last_visit_date` を自動更新
  - 計算方式: `stamp_count = MAX(stamp_number)`
- `trigger_update_profile_on_stamp_delete` (AFTER DELETE) - 016マイグレーションで追加
  - スタンプ削除時に `profiles.stamp_count`, `visit_count`, `last_visit_date` を再計算
  - 計算方式: `stamp_count = MAX(stamp_number)`, `visit_count = COUNT(*)`, `last_visit_date = MAX(visit_date)`

**重要な設計ポイント:**
- `stamp_number` は「その時点でのスタンプ数（累積）」を表す
  - 例: 1回目来院 → stamp_number = 1
  - 例: スタッフが「5個に設定」→ stamp_number = 5
- スタンプ数 = `MAX(stamp_number)` （`COUNT(*)` ではない）
- 訪問回数 = `COUNT(*)` （レコード数）

---

### 3. `families` テーブル

**説明:** 家族グループの実体を管理（Phase 2で追加）

**作成:** `009_add_family_support.sql`

| カラム名 | 型 | NULL許可 | デフォルト | 説明 |
|---------|---|---------|----------|------|
| `id` | TEXT | NO | gen_random_uuid()::TEXT | **主キー**: 家族グループの一意識別子（UUID形式、TEXT型） |
| `family_name` | TEXT | NO | - | 家族名（例: "横山家"、"○○さんの家族"） |
| `representative_user_id` | TEXT | YES | - | **外部キー**: 代表者（親）のID（profiles.id へのリンク） |
| `created_at` | TIMESTAMPTZ | NO | NOW() | レコード作成日時 |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | レコード更新日時（トリガーで自動更新） |

**インデックス:**
- `idx_families_representative` - 代表者IDでの検索用

**制約:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `representative_user_id` → `profiles(id)` ON DELETE SET NULL

**RLS (Row Level Security):**
- ✅ 有効
- ポリシー: `allow_public_read_families`, `allow_public_insert_families`, `allow_public_update_families`, `allow_public_delete_families` (開発段階)

**トリガー:**
- `trigger_update_families_updated_at` (BEFORE UPDATE)
  - 更新時に `updated_at` を自動更新

**設計ポイント:**
- `id` は UUID 形式だが TEXT 型で保存（`profiles.id` が TEXT 型のため統一）
- `representative_user_id` と `profiles.family_id` は循環参照の関係
- 家族削除時、メンバーの `family_id` は NULL になる（単身に戻る）
- 代表者削除時、家族は残る（`representative_user_id` が NULL になる）

---

### 4. `rewards` テーブル

**説明:** 特典マスター（旧仕様・手動交換型）

**作成:** `003_create_rewards_tables.sql`

**⚠️ 現在の状態:** データなし（未使用）。新仕様では `milestone_rewards` を使用。

| カラム名 | 型 | NULL許可 | デフォルト | 説明 |
|---------|---|---------|----------|------|
| `id` | UUID | NO | gen_random_uuid() | **主キー**: 特典の一意識別子 |
| `name` | TEXT | NO | - | 特典名 |
| `description` | TEXT | YES | - | 詳細説明 |
| `required_stamps` | INTEGER | NO | - | 必要なスタンプ数（固定） |
| `image_url` | TEXT | YES | - | 特典画像URL（オプション） |
| `is_active` | BOOLEAN | NO | true | 有効/無効フラグ |
| `display_order` | INTEGER | NO | 0 | 表示順序 |
| `created_at` | TIMESTAMPTZ | NO | NOW() | レコード作成日時 |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | レコード更新日時 |

**設計ポイント:**
- テーブルは保持されているが、データは空（新仕様へ移行済み）
- 外部キー参照のため削除していない

---

### 4b. `milestone_rewards` テーブル

**説明:** マイルストーン型特典マスター（新仕様）

**作成:** `021_milestone_rewards_migration.sql`

| カラム名 | 型 | NULL許可 | デフォルト | 説明 |
|---------|---|---------|----------|------|
| `id` | UUID | NO | gen_random_uuid() | **主キー**: 特典の一意識別子 |
| `name` | TEXT | NO | - | 特典名 |
| `description` | TEXT | YES | - | 詳細説明 |
| `milestone_type` | TEXT | NO | - | マイルストーンルール ('every_10', 'every_50', 'every_150_from_300') |
| `reward_type` | TEXT | NO | - | 特典タイプ ('toothbrush', 'poic', 'premium_menu') |
| `is_first_time_special` | BOOLEAN | NO | false | 初回特別対応フラグ（POIC用） |
| `first_time_description` | TEXT | YES | - | 初回の説明文 |
| `subsequent_description` | TEXT | YES | - | 2回目以降の説明文 |
| `validity_months` | INTEGER | YES | - | 有効期限（月数、NULL=無期限） |
| `display_order` | INTEGER | NO | 0 | 表示順序 |
| `is_active` | BOOLEAN | NO | true | 有効/無効フラグ |
| `created_at` | TIMESTAMPTZ | NO | NOW() | レコード作成日時 |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | レコード更新日時 |

**現在のデータ（3件）:**

| 特典名 | milestone_type | reward_type | validity_months |
|-------|---------------|-------------|----------------|
| 歯ブラシ 1本 | every_10 | toothbrush | 0（当日限り） |
| POIC殺菌剤 | every_50 | poic | 5（5ヶ月） |
| 選べるメニュー割引 | every_150_from_300 | premium_menu | 5（5ヶ月） |

**マイルストーンルール:**
- `every_10`: 10, 20, 30, 40... 10の倍数ごと
- `every_50`: 50, 100, 150... 50の倍数ごと
- `every_150_from_300`: 300, 450, 600... 300以降150の倍数ごと

**優先度:**
- 複数のマイルストーンが重なる場合、reward_typeの優先度で決定
- premium_menu > poic > toothbrush
- 例: 50スタンプ到達 → POICのみ（歯ブラシはスキップ）

---

### 5. `reward_exchanges` テーブル

**説明:** 特典交換履歴（新旧両対応）

**作成:** `003_create_rewards_tables.sql` + `021_milestone_rewards_migration.sql`

| カラム名 | 型 | NULL許可 | デフォルト | 説明 |
|---------|---|---------|----------|------|
| `id` | UUID | NO | gen_random_uuid() | **主キー**: 交換履歴の一意識別子 |
| `user_id` | TEXT | NO | - | **外部キー**: profiles.id へのリンク |
| `reward_id` | UUID | NO | - | rewards.id または milestone_rewards.id（外部キー制約なし） |
| `stamp_count_used` | INTEGER | NO | - | 使用したスタンプ数（参考値、積み上げ式なので実際は減らない） |
| `milestone_reached` | INTEGER | YES | - | **到達したマイルストーン**（10, 50, 300...、新仕様のみ） |
| `is_milestone_based` | BOOLEAN | NO | false | **新仕様フラグ**（true=マイルストーン型、false=旧仕様） |
| `valid_until` | TIMESTAMPTZ | YES | - | 有効期限（自費メニュー用、新仕様のみ） |
| `is_first_time` | BOOLEAN | NO | false | 初回特典フラグ（POIC用、新仕様のみ） |
| `exchanged_at` | TIMESTAMPTZ | NO | NOW() | 交換日時 |
| `status` | TEXT | NO | 'pending' | ステータス ('pending', 'completed', 'cancelled', 'expired') |
| `notes` | TEXT | YES | - | 管理者による備考 |
| `created_at` | TIMESTAMPTZ | NO | NOW() | レコード作成日時 |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | レコード更新日時 |

**インデックス:**
- `idx_reward_exchanges_user_id` - ユーザーごとの交換履歴検索用
- `idx_reward_exchanges_reward_id` - 特典ごとの交換履歴検索用
- `idx_reward_exchanges_status` - ステータスでの検索用

**制約:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `user_id` → `profiles(id)` ON DELETE CASCADE
- ⚠️ `reward_id` の外部キー制約は削除済み（新旧両テーブルを参照するため）
- UNIQUE: `(user_id, reward_id, milestone_reached)` - 同一マイルストーンの重複防止

**RLS (Row Level Security):**
- ✅ 有効
- ポリシー: `allow_public_read_exchanges`, `allow_public_insert_exchanges` (開発段階)

**ステータス管理:**

| ステータス | 意味 | 運用 |
|-----------|------|------|
| `pending` | 受付で確認中 | 特典を提供する前 |
| `completed` | 提供完了 | 受付で実際に特典を渡した後 |
| `cancelled` | キャンセル | 誤交換などの取り消し |
| `expired` | 期限切れ | 有効期限切れ（新仕様のみ） |

**新旧の区別:**
- `is_milestone_based = true`: 新仕様（マイルストーン型）
- `is_milestone_based = false`: 旧仕様（手動交換型、現在は未使用）

---

### 5b. `milestone_history` テーブル

**説明:** マイルストーン到達履歴

**作成:** `021_milestone_rewards_migration.sql`

| カラム名 | 型 | NULL許可 | デフォルト | 説明 |
|---------|---|---------|----------|------|
| `id` | UUID | NO | gen_random_uuid() | **主キー**: 履歴の一意識別子 |
| `user_id` | TEXT | NO | - | **外部キー**: profiles.id へのリンク |
| `milestone` | INTEGER | NO | - | 到達したマイルストーン（10, 20, 50, 100...） |
| `reward_exchange_id` | UUID | YES | - | 付与された特典のID（reward_exchanges.id） |
| `reached_at` | TIMESTAMPTZ | NO | NOW() | 到達日時 |
| `created_at` | TIMESTAMPTZ | NO | NOW() | レコード作成日時 |

**インデックス:**
- `idx_milestone_history_user` - ユーザーIDでの検索用
- `idx_milestone_history_milestone` - マイルストーンでの検索用

**制約:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `user_id` → `profiles(id)` ON DELETE CASCADE
- UNIQUE: `(user_id, milestone)` - 同じマイルストーンは1回のみ

**設計ポイント:**
- スタンプ付与時に自動的にレコードが作成される
- 同じユーザーが同じマイルストーンに2回到達することを防ぐ

---

### 6. `family_stamp_totals` ビュー

**説明:** 家族ごとのスタンプ合計・来院回数を集計（Phase 2で追加）

**作成:** `009_add_family_support.sql`

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `family_id` | TEXT | 家族グループID（families.id） |
| `family_name` | TEXT | 家族名 |
| `representative_user_id` | TEXT | 代表者（親）のID |
| `total_stamp_count` | BIGINT | 家族の合計スタンプ数 |
| `total_visit_count` | BIGINT | 家族の合計来院回数 |
| `member_count` | BIGINT | 家族のメンバー数 |
| `last_family_visit` | TIMESTAMPTZ | 家族の最終来院日 |
| `last_family_login` | TIMESTAMPTZ | 家族の最終ログイン日時 |
| `created_at` | TIMESTAMPTZ | 家族作成日時 |
| `updated_at` | TIMESTAMPTZ | 家族更新日時 |

**定義SQL:**
```sql
CREATE OR REPLACE VIEW family_stamp_totals AS
SELECT
  f.id AS family_id,
  f.family_name,
  f.representative_user_id,
  SUM(p.stamp_count) AS total_stamp_count,
  SUM(p.visit_count) AS total_visit_count,
  COUNT(p.id) AS member_count,
  MAX(p.last_visit_date) AS last_family_visit,
  MAX(p.updated_at) AS last_family_login,
  f.created_at,
  f.updated_at
FROM families f
LEFT JOIN profiles p ON p.family_id = f.id
GROUP BY f.id, f.family_name, f.representative_user_id, f.created_at, f.updated_at;
```

**使用例:**
```sql
-- 特定家族のスタンプ合計を取得
SELECT total_stamp_count, member_count
FROM family_stamp_totals
WHERE family_id = 'fbaae6e8-e64f-4748-81b8-dbb455393b1e';

-- 家族ごとのスタンプ数ランキング
SELECT family_name, total_stamp_count, member_count
FROM family_stamp_totals
ORDER BY total_stamp_count DESC
LIMIT 10;
```

**設計ポイント:**
- リアルタイムで計算される（マテリアライズドビューではない）
- 家族にメンバーが1人もいない場合、`total_stamp_count` は NULL
- `member_count` は家族に紐付いている profiles の数

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

### 1-2. `update_profile_on_stamp_delete()`

**説明:** スタンプ履歴が削除されたら profiles テーブルを再計算（Phase 3で追加、016マイグレーション）

**作成:** `016_add_delete_policy_stamp_history.sql`

**トリガー:** `trigger_update_profile_on_stamp_delete` (AFTER DELETE on stamp_history)

**処理内容:**
```sql
-- stamp_count を MAX(stamp_number) で再計算
-- visit_count を COUNT(*) WHERE amount = 10 で再計算（通常来院のみカウント）
-- last_visit_date を MAX(visit_date) で再計算
-- updated_at を NOW() で更新
-- レコードが0件の場合はすべて 0 または NULL にリセット
```

**設計ポイント:**
- スタンプ減少時（管理画面での手動調整）に `profiles` テーブルとの整合性を保つ
- INSERT トリガーと同じく `MAX(stamp_number)` を使用して計算方法を統一
- 削除後にレコードが残っていない場合は初期状態に戻す

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

### 6. `update_families_updated_at()`

**説明:** families テーブルの updated_at を自動更新（Phase 2で追加）

**作成:** `009_add_family_support.sql`

**トリガー:** `trigger_update_families_updated_at` (BEFORE UPDATE on families)

**処理内容:**
```sql
-- families テーブルが更新されたら updated_at を NOW() で更新
```

---

### 7. `search_profiles_by_real_name(search_term TEXT)`

**説明:** 本名またはLINE表示名で患者を検索（大文字小文字を区別しない、Phase 2で追加）

**作成:** `012_add_real_name_column.sql`

**引数:** `search_term TEXT` - 検索キーワード

**戻り値:** TABLE (id, line_user_id, display_name, real_name, ticket_number, stamp_count)

**処理内容:**
```sql
-- real_name または display_name に部分一致する患者を検索
-- ILIKE '%search_term%' で大文字小文字を区別しない
-- ORDER BY real_name ASC NULLS LAST でソート
```

**使用例:**
```sql
-- 本名が「山田」を含む患者を検索
SELECT * FROM search_profiles_by_real_name('山田');

-- 表示名または本名が「太郎」を含む患者を検索
SELECT * FROM search_profiles_by_real_name('太郎');
```

**利点:**
- 大文字小文字を区別しない検索（ひらがな・カタカナも柔軟）
- 本名とLINE表示名の両方を一度に検索
- 部分一致で検索しやすい

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

**セキュリティレベル: ⭐⭐⭐ (中)**

**最終更新日:** 2026-04-04
**実装状態:** 本番環境適用済み
**マイグレーションファイル:** [supabase/026B_minimal_rls_hardening_fixed.sql](../supabase/026B_minimal_rls_hardening_fixed.sql)

---

#### 📊 実装済みRLSポリシー一覧（22ポリシー）

全てのテーブルでRLS有効化済み。フォーマット検証により不正なIDでのアクセスをブロック。

**対応ID形式:**
- 本番LINE User ID: `U[0-9a-f]{32}$` (例: `U5c70cd61f4fe89a65381cd7becee8de3`)
- テストLINE User ID: `U_test_` (例: `U_test_1770547971169`)
- 代理管理メンバー: `manual-child-` (例: `manual-child-<UUID>`)

---

##### 1. profiles テーブル (4ポリシー)

| ポリシー名 | 操作 | 説明 |
|-----------|------|------|
| `profiles_read_with_format_check` | SELECT | 正規表現によるID形式検証 + `.eq()`フィルタ |
| `profiles_insert_with_format_check` | INSERT | 正規表現によるID形式検証 |
| `profiles_update_with_format_check` | UPDATE | 正規表現によるID形式検証 |
| `profiles_deny_delete` | DELETE | 全拒否（アプリケーション層で制御） |

---

##### 2. stamp_history テーブル (4ポリシー)

| ポリシー名 | 操作 | 説明 |
|-----------|------|------|
| `stamp_history_read_with_format_check` | SELECT | user_id形式検証 + `.eq()`フィルタ |
| `stamp_history_insert_with_format_check` | INSERT | user_id形式検証 |
| `stamp_history_deny_update` | UPDATE | 全拒否（履歴は不変） |
| `stamp_history_deny_delete` | DELETE | 全拒否（管理画面で制御） |

---

##### 3. reward_exchanges テーブル (4ポリシー)

| ポリシー名 | 操作 | 説明 |
|-----------|------|------|
| `reward_exchanges_read_with_format_check` | SELECT | user_id形式検証 + `.eq()`フィルタ |
| `reward_exchanges_insert_with_format_check` | INSERT | user_id形式検証 |
| `reward_exchanges_deny_update` | UPDATE | 全拒否（ステータス更新は管理画面） |
| `reward_exchanges_deny_delete` | DELETE | 全拒否（履歴保持） |

---

##### 4. families テーブル (4ポリシー)

| ポリシー名 | 操作 | 説明 |
|-----------|------|------|
| `families_read_with_format_check` | SELECT | representative_user_id形式検証 |
| `families_insert_with_format_check` | INSERT | representative_user_id形式検証 |
| `families_update_with_format_check` | UPDATE | representative_user_id形式検証 |
| `families_deny_delete` | DELETE | 全拒否（家族解散は管理画面） |

---

##### 5. patient_dental_records テーブル (1ポリシー)

| ポリシー名 | 操作 | 説明 |
|-----------|------|------|
| `dental_records_read_with_format_check` | SELECT | patient_id形式検証（閲覧のみ許可） |

**注:** INSERT/UPDATE/DELETEは管理画面経由のみ（RPC関数使用）

---

##### 6. milestone_history テーブル (4ポリシー)

| ポリシー名 | 操作 | 説明 |
|-----------|------|------|
| `milestone_history_read_with_format_check` | SELECT | user_id形式検証 |
| `milestone_history_deny_insert` | INSERT | 全拒否（トリガーで自動生成） |
| `milestone_history_deny_update` | UPDATE | 全拒否（履歴は不変） |
| `milestone_history_deny_delete` | DELETE | 全拒否（履歴保持） |

---

##### 7. event_logs テーブル (1ポリシー)

| ポリシー名 | 操作 | 説明 |
|-----------|------|------|
| `event_logs_deny_all_anon` | ALL | anonロールでの全操作拒否（INSERT専用） |

**注:** アプリケーション層で `INSERT` のみ実行。SELECT/UPDATE/DELETEは管理ダッシュボード（SERVICE_ROLE_KEY）のみ。

---

#### 🔍 セキュリティ実装の仕組み

**1. フォーマット検証アプローチ**
```sql
-- 例: profiles_read_with_format_check
CREATE POLICY "profiles_read_with_format_check"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (
    id ~ '^U[0-9a-f]{32}$' OR       -- 本番LINE User ID
    id ~ '^U_test_' OR               -- テストLINE User ID
    id LIKE 'manual-child-%'         -- 代理管理メンバー
  );
```

**2. クライアントコードの`.eq()`フィルタと組み合わせ**
```typescript
// 全ての実装コードで既に使用されているパターン
const { data } = await supabase
  .from("profiles")
  .select("*")
  .eq("id", userId)  // ← これがあるから安全
  .single();
```

**効果:**
- RLSで「形式が正しいID」のみ通過
- `.eq()`で「自分のID」のみ取得
- 結果: 正規のユーザーが自分のデータのみアクセス可能 ✅

---

#### ⚠️ 既知の制限

**現在の保護レベル:**
- ✅ ANON_KEYによる一括データ抽出をブロック
- ✅ 不正な形式のIDでのアクセスをブロック
- ⚠️ 有効なLINE User IDを知っている攻撃者は他人のデータにアクセス可能

**将来の対策:**
- サーバーサイドAPI経由でのアクセス制御（auth.uid()を使用）
- 詳細は [Doc_miniApps/63_セキュリティ対策_完全版.md](63_セキュリティ対策_完全版.md) を参照

---

#### 📋 管理ダッシュボードへの影響

**影響なし ✅**

管理ダッシュボードは `SERVICE_ROLE_KEY` を使用しているため、全てのRLSポリシーをバイパス可能。
詳細は [Doc_miniApps/62_管理ダッシュボード側への伝達事項.md](62_管理ダッシュボード側への伝達事項.md) を参照。

---

#### 🔄 ロールバック手順

緊急時のロールバック方法は [Doc_miniApps/64_RLS強化マイグレーション_実行手順書.md](64_RLS強化マイグレーション_実行手順書.md) を参照。

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

### 家族のスタンプ合計取得（Phase 2）

```sql
-- 特定ユーザーの家族スタンプ合計を取得
SELECT
  p.display_name AS ユーザー名,
  p.family_role AS 役割,
  fst.family_name AS 家族名,
  fst.total_stamp_count AS 家族合計スタンプ,
  fst.member_count AS メンバー数
FROM profiles p
JOIN family_stamp_totals fst ON p.family_id = fst.family_id
WHERE p.line_user_id = 'Ufff5352c2c1ff940968ae09571d92a8e';

-- 家族ごとのスタンプ数ランキング
SELECT
  family_name AS 家族名,
  total_stamp_count AS 合計スタンプ数,
  member_count AS メンバー数
FROM family_stamp_totals
WHERE member_count > 0
ORDER BY total_stamp_count DESC;
```

---

## 🚀 マイグレーション実行順序

データベースをゼロから構築する場合、以下の順序でSQLファイルを実行してください。

| 順序 | ファイル名 | 説明 | Phase |
|-----|-----------|------|-------|
| 1 | `001_create_profiles_table.sql` | プロフィールテーブル作成 | Phase 0 |
| 2 | `002_create_stamp_history_table.sql` | スタンプ履歴テーブル + トリガー作成 | Phase 0 |
| 3 | `003_create_rewards_tables.sql` | 特典システムテーブル + 初期データ | Phase 0 |
| 4 | `004_add_is_line_friend_column.sql` | 友だち登録フラグ追加 | Phase 0 |
| 5 | `005_add_view_mode_column.sql` | 表示モードカラム追加 | Phase 0 |
| 6 | `006_add_next_memo_columns.sql` | 次回メモ機能カラム + トリガー追加 | Phase 0 |
| 7 | `007_add_reservation_clicks.sql` | 予約ボタンクリック数カラム + 関数追加 | Phase 0 |
| 8 | `008_add_10x_system_columns.sql` | スタンプ履歴拡張（visit_count, amount カラム追加） | Phase 1 |
| 9 | `009_add_family_support.sql` | **家族機能追加**（families テーブル、family_id/family_role カラム、family_stamp_totals ビュー） | **Phase 2** |
| 10 | `009_fix_rls_policies.sql` | RLSポリシー修正（auth.uid() 削除） | Phase 2 |
| 11 | `012_add_real_name_column.sql` | 本名カラム追加（real_name、idx_profiles_real_name、search_profiles_by_real_name関数） | Phase 2 |
| 12 | `013_create_staff_table.sql` | スタッフアカウントテーブル作成 | Phase 2 |
| 13 | `014_create_activity_logs_table.sql` | スタッフ操作ログテーブル作成 | Phase 2 |
| 14 | `015_create_event_logs_table_ForUser.sql` | ユーザー行動ログテーブル + ビュー作成 | Phase 2 |
| 15 | `016_add_delete_policy_stamp_history.sql` | **stamp_history DELETE/UPDATEポリシー + DELETEトリガー追加**（スタンプ削除時の整合性維持） | **Phase 3** |
| 16 | `019_create_dental_records_table.sql` | 歯科ケア記録テーブル + RPC関数作成 | Phase 3 |

**注意:**
- 002 は 001 に依存（外部キー: profiles.id）
- 003 は 001 に依存（外部キー: profiles.id）
- 004〜007 は 001 に依存（profiles テーブルへのカラム追加）
- 009 は 001 に依存（families ↔ profiles の循環参照）

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

- [03_管理ダッシュボード仕様書.md](03_管理ダッシュボード仕様書.md) - 各機能の詳細仕様
- [99_変更履歴.md](99_変更履歴.md) - 実装状況・変更履歴
- [00_ファイル構成.md](00_ファイル構成.md) - プロジェクト構成

---

## 7. activity_logs テーブル

> スタッフの管理画面操作を記録する監査ログ。詳細は [31_イベントログ設計_スタッフ操作.md](31_イベントログ設計_スタッフ操作.md) 参照。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|----------|-----|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `staff_id` | UUID | YES | - | 操作したスタッフ（FK → staff.id）。NULL = 従来の admin |
| `action` | TEXT | NO | - | 操作種別（login, profile_update, stamp_increment 等） |
| `target_type` | TEXT | YES | - | 対象の種類（profile, reward_exchange, family 等） |
| `target_id` | TEXT | YES | - | 対象のID |
| `details` | JSONB | YES | - | 補足データ |
| `created_at` | TIMESTAMPTZ | NO | NOW() | 発生日時 |

**マイグレーション:** `014_create_activity_logs_table.sql`
**RLS:** 読み取り・挿入のみ。更新・削除は不可（追記のみ）。

---

## 8. event_logs テーブル

> ユーザー（患者/LIFFアプリ利用者）の行動ログ。詳細は [32_イベントログ設計_ユーザ操作.md](32_イベントログ設計_ユーザ操作.md) 参照。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|----------|-----|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `user_id` | TEXT | YES | - | ユーザーID（FK → profiles.id） |
| `event_name` | TEXT | NO | - | イベント種別（app_open, stamp_scan_success 等） |
| `source` | TEXT | YES | - | 流入元（line_msg_YYMMDD, direct 等） |
| `metadata` | JSONB | YES | - | 追加データ（user_agent, screen_size 等） |
| `created_at` | TIMESTAMPTZ | NO | NOW() | 発生日時 |

**マイグレーション:** `015_create_event_logs_table_ForUser.sql`
**データ保持期間:** 400日（約13ヶ月）
**RLS:** ユーザーは自分のログのみ挿入可。管理者はサービスロールで全件参照。

---

## 9. staff テーブル

> スタッフアカウント管理。詳細は [30_スタッフアカウント仕様.md](30_スタッフアカウント仕様.md) 参照。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|----------|-----|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `login_id` | TEXT | NO | - | ログインID（UNIQUE） |
| `password_hash` | TEXT | NO | - | パスワードハッシュ |
| `display_name` | TEXT | NO | - | 表示名 |
| `is_active` | BOOLEAN | NO | TRUE | 有効フラグ（論理削除用） |
| `created_at` | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | 更新日時 |

**マイグレーション:** `013_create_staff_table.sql`
**RLS:** サービスロール経由のアクセスのみ。

---

## 10. patient_dental_records テーブル

> 歯科ケア記録（Phase 3 追加）。患者ごとの歯の治療状況を記録。詳細は [41_ケア記録機能.md](41_ケア記録機能.md) および [42_ケア記録機能_LIFF開発者向け.md](42_ケア記録機能_LIFF開発者向け.md) 参照。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|----------|-----|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `patient_id` | TEXT | NO | - | 患者ID（FK → profiles.id） ON DELETE CASCADE |
| `tooth_data` | JSONB | NO | '{}'::jsonb | 歯の状態データ（歯番号をキーとしたJSONB） |
| `staff_id` | UUID | YES | - | 記録したスタッフ（FK → staff.id） ON DELETE SET NULL |
| `staff_memo` | TEXT | YES | - | スタッフ専用メモ（患者には非表示、最大500文字） |
| `next_visit_memo` | TEXT | YES | - | 次回来院メモ（患者にも表示、最大200文字） |
| `recorded_at` | TIMESTAMPTZ | NO | NOW() | 記録日時 |
| `created_at` | TIMESTAMPTZ | NO | NOW() | レコード作成日時 |

**tooth_dataの構造（JSONB）:**
```json
{
  "44": {
    "status": "cavity_completed",
    "status_label": "虫歯治療済",
    "color": "#10b981",
    "updated_at": "2026-03-06T14:30:00Z"
  },
  "22": {
    "status": "in_treatment",
    "status_label": "治療中",
    "color": "#f97316",
    "updated_at": "2026-03-07T10:00:00Z"
  }
}
```

**status値の定義（2026-03-07更新）:**

| status値 | ラベル | 色（hex） | 意味 |
|----------|--------|----------|------|
| `cavity_completed` | 虫歯治療済 | `#10b981` (緑) | 虫歯治療完了 |
| `observation` | 経過観察 | `#eab308` (黄) | 経過観察中 |
| `cavity_planned` | 治療予定 | `#dc2626` (赤) | 治療予定・要注意 |
| `in_treatment` | 治療中 | `#f97316` (オレンジ) | 現在治療中 |
| `crown` | 被せ物 | `#3b82f6` (青) | クラウン・インレー装着済み |
| `scaling_completed` | 歯石除去 | `#06b6d4` (水色) | スケーリング完了 |
| `cleaning` | クリーニング | `#a855f7` (紫) | 予防クリーニング |

**歯番号（ISO 3950方式）:**
- 永久歯（32本）: 11-18（右上）, 21-28（左上）, 31-38（左下）, 41-48（右下）
- 乳歯（20本）: 51-55（右上）, 61-65（左上）, 71-75（左下）, 81-85（右下）

**インデックス:**
- `idx_dental_records_patient` - 患者IDでの検索用
- `idx_dental_records_date` - 記録日時降順での検索用

**制約:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `patient_id` → `profiles(id)` ON DELETE CASCADE
- FOREIGN KEY: `staff_id` → `staff(id)` ON DELETE SET NULL

**RLS (Row Level Security):**
- ✅ 有効
- ポリシー:
  - `anon_can_read_own_dental_records` - anonキーで全件SELECT可能（アプリ層でフィルタ）
  - `allow_insert_dental_records` - INSERT可能（管理画面・RPC経由）
  - `allow_update_dental_records` - UPDATE可能

**Supabase RPC関数:**
- `get_latest_dental_record(p_patient_id TEXT)` - 最新の記録1件を取得（LIFF用）
- `get_dental_record_history(p_patient_id TEXT, p_limit INT, p_offset INT)` - 履歴取得（タイムライン用）
- `get_tooth_detail_history(p_patient_id TEXT, p_tooth_number TEXT)` - 特定の歯の履歴

**マイグレーション:** `019_create_dental_records_table.sql`

**設計ポイント:**
- JSONB形式で柔軟な歯データ構造（将来の拡張に対応）
- 管理画面からの記録はNext.js APIエンドポイント経由
- LIFF アプリからの閲覧はSupabase RPC関数を直接呼び出し
- staff_memoとnext_visit_memoを分離（公開範囲が異なる）

---

## 改訂履歴

| 日付 | バージョン | 内容 |
|------|----------|------|
| 2026-02-16 | 1.0 | 初版作成：全テーブル・関数・トリガーを統合したスキーマドキュメント |
| 2026-02-16 | 1.1 | 008マイグレーション追加（visit_count, amount カラム）、スタンプ表記を「点」に統一 |
| 2026-02-18 | 1.2 | **Phase 2 家族機能追加**：families テーブル、family_stamp_totals ビュー、profiles テーブルへの family_id/family_role カラム追加、ER図更新、009/009-fixマイグレーション追加 |
| 2026-02-22 | 1.3 | **Phase 2 本名フィールド追加**：profiles.real_name カラム、idx_profiles_real_name インデックス、search_profiles_by_real_name() 関数、012マイグレーション追加 |
| 2026-03-01 | 1.4 | **staff / activity_logs / event_logs テーブル追加**：スタッフアカウント・操作ログ・ユーザー行動ログのテーブル定義、ビュー（daily_active_users, event_summary）追記 |
| 2026-03-07 | 1.5 | **Phase 3 ケア記録機能追加**：patient_dental_records テーブル、8種類のstatus定義（治療中追加）、Supabase RPC関数3つ、019マイグレーション追加 |
| 2026-03-15 | 1.6 | **stamp_history RLS更新（実測確認に基づく）**：016マイグレーションの DELETE/UPDATE ポリシーとDELETEトリガーを追記、update_profile_on_stamp_delete() 関数追加、マイグレーション順序更新 |
| 2026-03-27 | 1.7 | **マイルストーン型特典システム実装**：milestone_rewards テーブル追加（3種類の特典）、milestone_history テーブル追加、reward_exchanges テーブルに4つの新カラム追加（milestone_reached, is_milestone_based, valid_until, is_first_time）、外部キー制約削除、021/022マイグレーション追加 |
| 2026-04-04 | 1.8 | **RLSセキュリティ強化・本番環境適用**：22個の新RLSポリシー実装（フォーマット検証型）、セキュリティレベル⭐→⭐⭐⭐へ向上、管理ダッシュボードへの影響なし、026B_minimal_rls_hardening_fixed.sqlマイグレーション実行済み、全テーブル（profiles, stamp_history, reward_exchanges, families, patient_dental_records, milestone_history, event_logs）にformat_checkポリシー適用 |

---

**作成者:** Claude Code
**最終更新日:** 2026-04-04
