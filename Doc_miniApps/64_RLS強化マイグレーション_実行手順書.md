# RLS強化マイグレーション 実行手順書

**作成日:** 2026-04-03
**対象ファイル:** `supabase/026_minimal_rls_hardening.sql`
**所要時間:** 30分〜1時間（テスト含む）

---

## ⚠️ 重要な注意事項

### 実行前に必ず確認

- [ ] **本番環境で実行する前に、バックアップを取得済みか？**
- [ ] **管理ダッシュボードは SERVICE_ROLE_KEY を使用しているか確認済みか？**
- [ ] **現在のRLSポリシーをエクスポート済みか？**
- [ ] **ロールバック手順を理解しているか？**
- [ ] **LINEミニアプリをすぐにテストできる環境があるか？**

### 想定される影響

| 項目 | 影響 |
|------|------|
| LINEミニアプリ | ✅ 影響なし（既存コードは `.eq()` を使用） |
| 管理ダッシュボード | ✅ 影響なし（SERVICE_ROLE_KEY 使用） |
| テストユーザー | ✅ アクセス可能（U_test_ パターン追加済み） |
| 全件取得攻撃 | ✅ ブロックされる |

---

## 📋 実行手順

### Step 0: 事前準備（15分）

#### 0-1. 現在のRLSポリシーをバックアップ

Supabase管理画面のSQLエディタで実行：

```sql
-- 現在のRLSポリシーをエクスポート
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles::text,
  cmd,
  qual AS using_clause,
  with_check
FROM pg_policies
WHERE tablename IN (
  'profiles', 'stamp_history', 'reward_exchanges', 'families',
  'patient_dental_records', 'milestone_history', 'event_logs',
  'families_parent_permissions'
)
ORDER BY tablename, cmd;
```

**結果をCSVでエクスポートして保存**
- ファイル名: `rls_policies_backup_2026-04-03.csv`
- 保存場所: ローカルPC

#### 0-2. 既存ポリシー名を確認

```sql
-- 削除対象のポリシー名を確認
SELECT tablename, policyname
FROM pg_policies
WHERE tablename IN (
  'profiles', 'stamp_history', 'reward_exchanges', 'families',
  'patient_dental_records', 'milestone_history', 'event_logs',
  'families_parent_permissions'
)
AND policyname IN (
  'allow_public_read',
  'allow_public_insert',
  'allow_public_update',
  'allow_public_delete',
  'allow_public_read_exchanges',
  'allow_public_insert_exchanges',
  'anon_can_read_dental_records',
  'milestone_history_user_read',
  'allow_anon_insert_event_logs',
  'allow_authenticated_insert_event_logs'
)
ORDER BY tablename;
```

**期待される結果:**
```
profiles          | allow_public_read
profiles          | allow_public_insert
profiles          | allow_public_update
stamp_history     | allow_public_read
stamp_history     | allow_public_insert
stamp_history     | allow_public_delete
stamp_history     | allow_public_update
...
```

#### 0-3. テストユーザーのLINE User IDを確認

```sql
-- テストユーザーの存在確認
SELECT id, display_name
FROM profiles
WHERE id LIKE 'U_test_%'
ORDER BY id;
```

**期待される結果:**
```
U_test_1770547971169 | 更新されたテストユーザー
U_test_1770556220450 | 更新されたテストユーザー
```

---

### Step 1: SQLマイグレーションの実行（5分）

#### 1-1. Supabase管理画面を開く

1. https://app.supabase.com/ にアクセス
2. プロジェクトを選択
3. 左メニューから「SQL Editor」を選択

#### 1-2. SQLファイルの内容を貼り付け

1. 「New query」をクリック
2. `supabase/026_minimal_rls_hardening.sql` の全内容をコピー
3. SQLエディタに貼り付け

#### 1-3. 実行前の最終確認

- [ ] SQLファイルの内容が正しいか確認
- [ ] 本番データベースに接続しているか確認
- [ ] バックアップを取得済みか確認

#### 1-4. 実行

1. **「Run」ボタンをクリック**
2. 実行結果を確認

**期待される出力:**

```
migration_started: 2026-04-03 10:30:00.123456+00

(26 rows affected) -- DROP POLICY × 20 + CREATE POLICY × 26

migration_completed: 2026-04-03 10:30:05.654321+00

schemaname | tablename | policyname | ...
-----------+-----------+------------+...
public     | profiles  | profiles_read_with_format_check | ...
public     | profiles  | profiles_insert_with_format_check | ...
...
```

**エラーがある場合:**
- エラーメッセージを確認
- 「ロールバック手順」に進む

---

### Step 2: 即座の動作確認（5分）

#### 2-1. ポリシーが正しく作成されたか確認

```sql
-- 新しいポリシーを確認
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN (
  'profiles', 'stamp_history', 'reward_exchanges', 'families',
  'patient_dental_records', 'milestone_history', 'event_logs',
  'families_parent_permissions'
)
AND policyname LIKE '%format_check%'
ORDER BY tablename, cmd;
```

**期待される結果:**
```
profiles              | profiles_read_with_format_check   | SELECT
profiles              | profiles_insert_with_format_check | INSERT
profiles              | profiles_update_with_format_check | UPDATE
stamp_history         | stamp_history_read_with_format_check | SELECT
...
(合計19ポリシー)
```

#### 2-2. 古いポリシーが削除されたか確認

```sql
-- 古いポリシーが残っていないか確認
SELECT tablename, policyname
FROM pg_policies
WHERE tablename IN (
  'profiles', 'stamp_history', 'reward_exchanges', 'families',
  'patient_dental_records', 'milestone_history', 'event_logs',
  'families_parent_permissions'
)
AND policyname IN (
  'allow_public_read',
  'allow_public_insert',
  'allow_public_update'
)
ORDER BY tablename;
```

**期待される結果:**
```
(0 rows) -- 古いポリシーは全て削除されているべき
```

---

### Step 3: セキュリティテスト（10分）

#### 3-1. 全件取得がブロックされることを確認

Supabase SQLエディタで実行（ANON_KEY使用）：

```sql
-- ANON_KEYでの全件取得を試みる
SELECT * FROM profiles LIMIT 10;
```

**期待される結果:**
```
ERROR: new row violates row-level security policy
```
または
```
(0 rows) -- データが取得できない
```

✅ エラーが出るか、0件が返ればOK

#### 3-2. 特定IDでの取得が成功することを確認

```sql
-- 本番ユーザーのIDで取得
SELECT id, display_name, stamp_count
FROM profiles
WHERE id = 'U5c70cd61f4fe89a65381cd7becee8de3';
```

**期待される結果:**
```
id                                | display_name | stamp_count
----------------------------------+--------------+-------------
U5c70cd61f4fe89a65381cd7becee8de3 | 横山浩紀     | 200
```

✅ データが取得できればOK

#### 3-3. テストユーザーがアクセスできることを確認

```sql
-- テストユーザーのIDで取得
SELECT id, display_name, stamp_count
FROM profiles
WHERE id = 'U_test_1770547971169';
```

**期待される結果:**
```
id                     | display_name              | stamp_count
-----------------------+---------------------------+-------------
U_test_1770547971169   | 更新されたテストユーザー  | 0
```

✅ データが取得できればOK

---

### Step 4: LINEミニアプリの動作確認（15分）

#### 4-1. 本番ユーザーでテスト

**テスト項目:**

| 番号 | 項目 | 確認内容 | 結果 |
|------|------|----------|------|
| 1 | ログイン | LINEから起動してプロフィールが表示される | ✅ / ❌ |
| 2 | 会員証表示 | スタンプ数・会員証番号が表示される | ✅ / ❌ |
| 3 | スタンプ履歴 | スタンプ履歴が表示される | ✅ / ❌ |
| 4 | QRスキャン | QRコードをスキャンしてスタンプが増える | ✅ / ❌ |
| 5 | 特典交換 | 特典一覧が表示される | ✅ / ❌ |
| 6 | 特典交換実行 | 特典を交換できる | ✅ / ❌ |
| 7 | 設定画面 | プロフィール編集ができる | ✅ / ❌ |
| 8 | 家族機能（親） | 子供のスタンプが見える | ✅ / ❌ |
| 9 | 家族機能（子） | スタンプカードが表示される | ✅ / ❌ |

#### 4-2. テストユーザーでテスト

**テストユーザーでログイン:**
- LINE User ID: `U_test_1770547971169`

**確認項目:**
- [ ] ログインできる
- [ ] プロフィールが表示される
- [ ] スタンプ履歴が表示される

#### 4-3. エラーが発生した場合

**エラーメッセージ例:**
```
Error: new row violates row-level security policy
```

**原因:**
- LINE User IDの形式が想定外
- RLSポリシーのパターンが不正確

**対処:**
1. エラーログから実際のLINE User IDを確認
2. `scripts/check-line-user-id-length.mjs` でパターンを再確認
3. 必要に応じてRLSポリシーのパターンを追加

---

### Step 5: 管理ダッシュボードの動作確認（5分）

#### 5-1. 管理ダッシュボードにアクセス

**確認項目:**

| 番号 | 項目 | 確認内容 | 結果 |
|------|------|----------|------|
| 1 | 患者一覧 | 全患者が表示される | ✅ / ❌ |
| 2 | 患者詳細 | 特定患者の詳細が表示される | ✅ / ❌ |
| 3 | スタンプ数変更 | スタンプ数を変更できる | ✅ / ❌ |
| 4 | 特典交換管理 | 特典交換履歴が表示される | ✅ / ❌ |
| 5 | QRコード生成 | QRコードが生成できる | ✅ / ❌ |

#### 5-2. エラーが発生した場合

**原因:**
- SERVICE_ROLE_KEY が設定されていない
- RLSポリシーが SERVICE_ROLE をブロックしている（通常ありえない）

**対処:**
```bash
# 環境変数を確認
cat .env.local | grep SUPABASE_SERVICE_ROLE_KEY

# 設定されていない場合は追加
echo "SUPABASE_SERVICE_ROLE_KEY=your_service_role_key" >> .env.local
```

---

### Step 6: 最終確認（5分）

#### 6-1. 全テスト結果のまとめ

| カテゴリ | 結果 | 備考 |
|---------|------|------|
| SQLマイグレーション実行 | ✅ / ❌ | |
| ポリシー作成確認 | ✅ / ❌ | |
| セキュリティテスト | ✅ / ❌ | |
| LINEミニアプリ（本番） | ✅ / ❌ | |
| LINEミニアプリ（テスト） | ✅ / ❌ | |
| 管理ダッシュボード | ✅ / ❌ | |

#### 6-2. すべて✅の場合

**完了！🎉**
- 実装履歴に記録
- ドキュメントを更新

#### 6-3. 1つでも❌がある場合

**ロールバック手順に進む**

---

## 🔄 ロールバック手順

### ロールバックが必要なケース

- LINEミニアプリでエラーが発生
- テストユーザーがアクセスできない
- 管理ダッシュボードでエラーが発生
- セキュリティテストが期待通りに動作しない

---

### 🚨 緊急ロールバック（5分以内）

**すべてのポリシーを一時的に無効化 → 古いポリシーを復元**

#### Step 1: 新しいポリシーを削除

```sql
-- profiles
DROP POLICY IF EXISTS "profiles_read_with_format_check" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_with_format_check" ON profiles;
DROP POLICY IF EXISTS "profiles_update_with_format_check" ON profiles;
DROP POLICY IF EXISTS "profiles_deny_delete" ON profiles;

-- stamp_history
DROP POLICY IF EXISTS "stamp_history_read_with_format_check" ON stamp_history;
DROP POLICY IF EXISTS "stamp_history_insert_with_format_check" ON stamp_history;
DROP POLICY IF EXISTS "stamp_history_deny_update" ON stamp_history;
DROP POLICY IF EXISTS "stamp_history_deny_delete" ON stamp_history;

-- reward_exchanges
DROP POLICY IF EXISTS "reward_exchanges_read_with_format_check" ON reward_exchanges;
DROP POLICY IF EXISTS "reward_exchanges_insert_with_format_check" ON reward_exchanges;
DROP POLICY IF EXISTS "reward_exchanges_deny_update" ON reward_exchanges;
DROP POLICY IF EXISTS "reward_exchanges_deny_delete" ON reward_exchanges;

-- families
DROP POLICY IF EXISTS "families_read_with_format_check" ON families;
DROP POLICY IF EXISTS "families_insert_with_format_check" ON families;
DROP POLICY IF EXISTS "families_update_with_format_check" ON families;
DROP POLICY IF EXISTS "families_deny_delete" ON families;

-- patient_dental_records
DROP POLICY IF EXISTS "dental_records_read_with_format_check" ON patient_dental_records;

-- milestone_history
DROP POLICY IF EXISTS "milestone_history_read_with_format_check" ON milestone_history;
DROP POLICY IF EXISTS "milestone_history_deny_insert" ON milestone_history;
DROP POLICY IF EXISTS "milestone_history_deny_update" ON milestone_history;
DROP POLICY IF EXISTS "milestone_history_deny_delete" ON milestone_history;

-- event_logs
DROP POLICY IF EXISTS "event_logs_deny_all_anon" ON event_logs;

-- families_parent_permissions
DROP POLICY IF EXISTS "parent_permissions_read_with_format_check" ON families_parent_permissions;
DROP POLICY IF EXISTS "parent_permissions_insert_with_format_check" ON families_parent_permissions;
DROP POLICY IF EXISTS "parent_permissions_update_with_format_check" ON families_parent_permissions;
DROP POLICY IF EXISTS "parent_permissions_deny_delete" ON families_parent_permissions;
```

#### Step 2: 古いポリシーを復元

```sql
-- profiles
CREATE POLICY "allow_public_read" ON profiles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "allow_public_insert" ON profiles FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "allow_public_update" ON profiles FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- stamp_history
CREATE POLICY "allow_public_read" ON stamp_history FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "allow_public_insert" ON stamp_history FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "allow_public_delete" ON stamp_history FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE POLICY "allow_public_update" ON stamp_history FOR UPDATE
  TO anon, authenticated
  USING (true);

-- reward_exchanges
CREATE POLICY "allow_public_read_exchanges" ON reward_exchanges FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "allow_public_insert_exchanges" ON reward_exchanges FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- families
CREATE POLICY "allow_public_read" ON families FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "allow_public_insert" ON families FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "allow_public_update" ON families FOR UPDATE
  TO anon, authenticated
  USING (true);

CREATE POLICY "allow_public_delete" ON families FOR DELETE
  TO anon, authenticated
  USING (true);

-- patient_dental_records
CREATE POLICY "anon_can_read_dental_records" ON patient_dental_records FOR SELECT
  TO anon, authenticated
  USING (true);

-- milestone_history
CREATE POLICY "milestone_history_user_read" ON milestone_history FOR SELECT
  TO anon, authenticated
  USING (true);

-- event_logs
CREATE POLICY "allow_anon_insert_event_logs" ON event_logs FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "allow_authenticated_insert_event_logs" ON event_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- families_parent_permissions
CREATE POLICY "allow_public_read" ON families_parent_permissions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "allow_public_insert" ON families_parent_permissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "allow_public_update" ON families_parent_permissions FOR UPDATE
  TO anon, authenticated
  USING (true);
```

#### Step 3: 動作確認

```sql
-- LINEミニアプリが動作することを確認
SELECT * FROM profiles WHERE id = 'あなたのLINE User ID';
```

✅ データが取得できればロールバック成功

---

### 📊 ロールバック完了後の対応

1. **原因を調査**
   - エラーログを確認
   - `scripts/check-line-user-id-length.mjs` でパターンを再確認
   - 実際のLINE User IDを確認

2. **SQLファイルを修正**
   - 正規表現パターンを修正
   - 不足しているケースを追加

3. **再度テスト**
   - 修正したSQLファイルでテスト環境で実行
   - 問題なければ本番環境で再実行

---

## 📝 トラブルシューティング

### 問題1: 「policy already exists」エラー

**症状:**
```
ERROR: policy "profiles_read_with_format_check" already exists
```

**原因:**
- ポリシーが既に存在する
- 以前の実行が途中で失敗した

**対処:**
```sql
-- 既存のポリシーを削除してから再実行
DROP POLICY IF EXISTS "profiles_read_with_format_check" ON profiles;
-- 他のポリシーも同様
```

---

### 問題2: テストユーザーがアクセスできない

**症状:**
```
Error: new row violates row-level security policy
```

**原因:**
- `U_test_` パターンが正しく追加されていない

**対処:**
```sql
-- パターンを確認
SELECT policyname, qual
FROM pg_policies
WHERE tablename = 'profiles'
  AND policyname = 'profiles_read_with_format_check';

-- 結果に「U_test_」が含まれているか確認
```

---

### 問題3: 管理ダッシュボードでエラー

**症状:**
```
管理ダッシュボードで患者一覧が表示されない
```

**原因:**
- SERVICE_ROLE_KEY が設定されていない可能性
- RLSポリシーが誤ってSERVICE_ROLEをブロックしている

**対処:**
```sql
-- SERVICE_ROLE でアクセスできるか確認
-- Supabase管理画面のSQLエディタ（SERVICE_ROLE）で実行
SELECT * FROM profiles LIMIT 10;

-- データが取得できればOK
-- 取得できない場合は、RLSポリシーを見直す
```

---

## ✅ チェックリスト

### 実行前

- [ ] バックアップを取得
- [ ] 既存ポリシー名を確認
- [ ] テストユーザーのLINE User IDを確認
- [ ] ロールバック手順を理解

### 実行中

- [ ] SQLマイグレーション実行
- [ ] エラーなく完了
- [ ] ポリシーが正しく作成された
- [ ] 古いポリシーが削除された

### テスト

- [ ] セキュリティテスト合格
- [ ] LINEミニアプリ（本番ユーザー）動作OK
- [ ] LINEミニアプリ（テストユーザー）動作OK
- [ ] 管理ダッシュボード動作OK

### 完了後

- [ ] 実装履歴に記録
- [ ] ドキュメントを更新
- [ ] チーム通知

---

**作成者:** Claude Code
**最終更新日:** 2026-04-03
**バージョン:** 1.0
