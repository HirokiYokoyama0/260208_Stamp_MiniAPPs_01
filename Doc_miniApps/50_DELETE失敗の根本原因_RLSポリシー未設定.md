# DELETE失敗の根本原因：RLSポリシー未設定

## 作成日
2026-03-15

## 問題の症状

### LIFFアプリ側
- 「本日のQRスキャンを削除」ボタンを押すと「削除成功」と表示
- しかし、実際にはデータベースから削除されていない
- **削除件数: 0件**

### Vercelログ
```
POST 200 /api/stamps/scan/delete-today
[Delete Today QR] 削除成功: 1件削除, -10ポイント
```
→ ログは「1件削除」と表示しているが、これは **検索で見つかった件数** であり、**実際に削除された件数ではない**

### データベース実態
```
ID: 73741219-fdd6-4475-99a5-66cb8ed7cc0b
user_id: U5c70cd61f4fe89a65381cd7becee8de3
stamp_number: 30
amount: 10
visit_date: 2026-03-15T01:36:30.677Z
stamp_method: qr_scan
```
→ **削除されていない**

---

## 🔍 調査結果

### テスト1: タイムゾーン問題の確認
```bash
npx tsx test/check-timezone-issue.ts
```

**結果**: ✅ 問題なし
- 検索範囲: `2026-03-15T00:00:00.000Z ~ 2026-03-15T23:59:59.999Z`
- データベース: `2026-03-15T01:36:30.677Z`
- → 検索範囲に含まれている

### テスト2: 実際のDELETE操作
```bash
npx tsx test/test-actual-delete.ts
```

**結果**: ❌ **削除されない**
```
📊 DELETE結果:
  count: 0
  error: なし

削除前の本日のQRスキャン: 1件
削除後の本日のQRスキャン: 1件（同じレコードが残っている）
```

**重要な発見**:
- DELETE操作はエラーなく成功している
- しかし、`count: 0` が返される
- 実際には削除されていない

### テスト3: RLSポリシーの確認
```bash
npx tsx test/check-stamp-history-rls.ts
```

**結果**:
```
✅ DELETE成功（0件削除）

💡 これは DELETE ポリシーが設定されていることを意味します！
→ ANON_KEY で DELETE が可能です
```

**矛盾**:
- テストスクリプトは「DELETEポリシーが設定済み」と判定
- しかし、実際のDELETE操作では `count: 0` で削除されない

---

## 🚨 根本原因

### RLS DELETE ポリシーが正しく設定されていない

#### 可能性1: ポリシーが存在しない
- `stamp_history` テーブルに DELETE ポリシーが設定されていない
- ANON_KEY では DELETE が暗黙的に拒否される
- エラーは返されず、`count: 0` が返される

#### 可能性2: ポリシーの条件が厳しすぎる
- DELETE ポリシーは存在するが、`USING (true)` ではない
- 例: `USING (user_id = auth.uid())` のような条件がある場合、ANON_KEY では `auth.uid()` が NULL になり、削除が拒否される

#### 可能性3: RLSが有効化されている
- `stamp_history` テーブルで RLS が有効化されている
- しかし、DELETE ポリシーが適切に設定されていない
- → ANON_KEY では削除できない

---

## 📊 検証方法

### Supabase管理画面で以下のSQLを実行してください

#### 1. RLS設定の確認
```sql
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'stamp_history';
```

**期待される結果**:
- `rowsecurity: true` → RLSが有効化されている

#### 2. RLSポリシーの確認
```sql
SELECT
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'stamp_history'
ORDER BY policyname;
```

**期待される結果（DELETEポリシーがある場合）**:
```
policyname: allow_public_delete
cmd: DELETE
roles: {public}
qual: true
```

**現在の結果（推測）**:
- DELETEポリシーが存在しない
- または、`qual` が `true` ではない

#### 3. トリガーの確認
```sql
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'stamp_history'
  AND trigger_name = 'trigger_update_profile_on_stamp_delete';
```

**期待される結果**:
- トリガーが存在する
- `event_manipulation: DELETE`

---

## 💡 解決策：016Bマイグレーションの適用

### ファイル
`supabase/016B_add_delete_policy_stamp_history.sql`

### 実行内容

#### 1. DELETE ポリシーの追加
```sql
CREATE POLICY "allow_public_delete"
  ON stamp_history
  FOR DELETE
  USING (true);
```
→ **全ユーザー（ANON_KEY含む）が削除可能に**

#### 2. UPDATE ポリシーの追加
```sql
CREATE POLICY "allow_public_update"
  ON stamp_history
  FOR UPDATE
  USING (true);
```

#### 3. DELETE トリガーの追加
```sql
CREATE OR REPLACE FUNCTION update_profile_on_stamp_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET
    stamp_count = (
      SELECT COALESCE(MAX(stamp_number), 0)
      FROM stamp_history
      WHERE user_id = OLD.user_id
    ),
    visit_count = (
      SELECT COUNT(*)
      FROM stamp_history
      WHERE user_id = OLD.user_id AND amount = 10
    ),
    last_visit_date = (
      SELECT MAX(visit_date)
      FROM stamp_history
      WHERE user_id = OLD.user_id
    ),
    updated_at = NOW()
  WHERE id = OLD.user_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_profile_on_stamp_delete
AFTER DELETE ON stamp_history
FOR EACH ROW
EXECUTE FUNCTION update_profile_on_stamp_delete();
```

---

## ⚠️ ダッシュボード側への確認事項

### 確認してほしいこと

1. **016マイグレーションの適用状況**
   - 既に適用済みですか？
   - 適用済みの場合、どの名前で適用されましたか？

2. **RLSポリシーの現在の設定**
   - `stamp_history` テーブルに DELETE ポリシーは設定されていますか？
   - 設定されている場合、`USING` 句はどうなっていますか？

3. **016Bマイグレーションの適用可否**
   - LIFFアプリ側から `016B_add_delete_policy_stamp_history.sql` を適用しても問題ありませんか？

---

## 📋 関連ドキュメント

- [Doc_miniApps/49_ダッシュボード側への確認事項_016Bマイグレーション.md](./49_ダッシュボード側への確認事項_016Bマイグレーション.md)
- [Doc_miniApps/05_Database_Schema.md](./05_Database_Schema.md)
- [supabase/016B_add_delete_policy_stamp_history.sql](../supabase/016B_add_delete_policy_stamp_history.sql)

---

## 🎯 次のステップ

1. ✅ マイグレーションファイルを016Bにリネーム
2. ✅ ダッシュボード側への確認ドキュメント作成
3. ✅ RLSポリシーとDELETEトリガーの適用状況確認
4. ✅ DELETE操作が失敗する根本原因を特定
5. ⏳ **ダッシュボード側からの回答を待つ**
6. ⏳ 016Bマイグレーションを適用（承認後）
7. ⏳ DELETE機能の動作確認

---

## 🙏 まとめ

**問題**: ANON_KEY で `stamp_history` を DELETE できない

**原因**: RLS DELETE ポリシーが設定されていない（または条件が厳しすぎる）

**解決策**: 016Bマイグレーションを適用して DELETE ポリシーとトリガーを追加

**次のアクション**: ダッシュボード側に確認を取る
