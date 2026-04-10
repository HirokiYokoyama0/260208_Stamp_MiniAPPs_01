# イベントログRLS修正のお知らせ

**作成日**: 2026-04-05
**対象**: LIFFアプリ開発者
**重要度**: 🔴 高（即座対応推奨）
**ステータス**: ✅ 修正完了・動作確認済み（2026-04-05 22:45）

---

## 📋 要約

セキュリティ強化（026_minimal_rls_hardening.sql）の際、**event_logsへのINSERTも誤って禁止**してしまいました。これにより、**2026-04-04 9:37以降、LIFFアプリからのイベントログ送信が完全に停止**していました。

**✅ 修正完了**: 031および032のマイグレーションを実行し、LINEアカウントからのイベントログ記録が再開されました。

---

## 🔍 問題の詳細

### 現在の状況

| 項目 | 修正前 | 修正後 |
|------|--------|--------|
| **管理ダッシュボード** | ✅ 正常動作（過去のログは表示可能） | ✅ 正常動作 |
| **LIFFアプリからのログ送信** | ❌ 完全に停止（2026-04-04 9:37以降） | ✅ 記録再開 |
| **停止期間の最新ログ** | 2026-04-04 9:37:20 (JST) | - |
| **停止時間** | 約21時間（修正まで） | - |

### 原因

[supabase/026_minimal_rls_hardening.sql](../supabase/026_minimal_rls_hardening.sql) で以下のポリシーを設定：

```sql
-- 問題のあるポリシー
CREATE POLICY "event_logs_deny_all_anon"
  ON event_logs FOR ALL
  TO anon, authenticated
  USING (false);
```

これにより：
- ❌ LIFFアプリ（ANON_KEY使用）からのINSERT: **禁止**
- ✅ 管理ダッシュボード（SERVICE_ROLE_KEY使用）からのSELECT: **可能**（RLSバイパス）

### 影響範囲

- **ユーザー行動ログ**: 記録されていない
- **マーケティング分析**: 直近21時間のデータが欠損
- **管理画面表示**: 過去のログは表示可能（新規ログがないだけ）

---

## 🛠️ 修正方法（実行済み）

### 手順1: SQLマイグレーションの実行 ✅

以下のマイグレーションを実行しました：

1. **[supabase/031_fix_event_logs_rls.sql](../supabase/031_fix_event_logs_rls.sql)**
   - 実行日時: 2026-04-05 22:34:09 (JST)
   - 内容: `event_logs_deny_all_anon`ポリシーを削除し、4つの新しいポリシーを作成

2. **[supabase/032_fix_event_logs_insert_policy.sql](../supabase/032_fix_event_logs_insert_policy.sql)**
   - 実行日時: 2026-04-05 22:40頃 (JST)
   - 内容: INSERTポリシーを再作成し、4つの条件すべてを適用
   - 理由: 031実行後に一部条件が適用されていなかったため

### 手順2: LIFFアプリで動作確認 ✅

**確認結果**: LINEアカウントからのイベントログ記録が再開されました。

修正後、以下のイベントが正常に記録されることを確認：

```
✅ アプリ起動（app_open イベント）
✅ スタンプページ閲覧（stamp_page_view イベント）
✅ QRスキャン（stamp_scan_success イベント）
✅ 予約ボタンクリック（reservation_button_click イベント）
```

### 手順3: 管理ダッシュボードで確認 ✅

1. 管理ダッシュボードにログイン
2. 「ユーザログ」ページ（`/admin/user-logs`）を開く
3. 新しいログが表示されることを確認

**確認結果**: 修正後のログが正常に表示されることを確認しました。

---

## 🔒 修正後のRLSポリシー

### SELECT（閲覧）

```sql
-- anon/authenticated ユーザーからの SELECT は禁止
CREATE POLICY "event_logs_deny_select_anon"
  ON event_logs FOR SELECT
  TO anon, authenticated
  USING (false);
```

**効果**:
- ❌ LIFFアプリからevent_logsを読み取ることは不可能
- ✅ 管理ダッシュボード（SERVICE_ROLE_KEY）は読み取り可能

### INSERT（追加）

```sql
-- LIFFアプリから送信可能（形式チェック付き）
CREATE POLICY "event_logs_allow_insert_with_format_check"
  ON event_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id ~ '^U[0-9a-f]{32}$' OR  -- 本番LINE User ID
    user_id ~ '^U_test_' OR          -- テストLINE User ID
    user_id LIKE 'manual-child-%' OR -- 代理管理メンバー
    user_id IS NULL                  -- 匿名イベント
  );
```

**効果**:
- ✅ LIFFアプリからevent_logsへのINSERTが可能
- ✅ user_idの形式チェックでセキュリティ確保
- ❌ 不正な形式のuser_idは拒否

### UPDATE/DELETE（更新・削除）

```sql
-- UPDATE/DELETE: 禁止
CREATE POLICY "event_logs_deny_update" ON event_logs FOR UPDATE
  TO anon, authenticated USING (false);

CREATE POLICY "event_logs_deny_delete" ON event_logs FOR DELETE
  TO anon, authenticated USING (false);
```

**効果**:
- ❌ LIFFアプリからevent_logsの更新・削除は不可能
- ✅ イベントログの不変性を保証

---

## ✅ 動作確認チェックリスト（完了）

### LIFFアプリ側

- [x] アプリ起動時に `app_open` イベントが送信される
- [x] QRスキャン時に `stamp_scan_success` イベントが送信される
- [x] エラーログにRLSエラーが出ていない

### 管理ダッシュボード側

- [x] `/admin/user-logs` で新しいログが表示される
- [x] ログに氏名・診察券が正常に表示される
- [x] CSV出力が正常に動作する

### セキュリティ確認（任意）

必要に応じて、以下のテストをブラウザのDevToolsで実行可能：

```javascript
// テスト1: SELECT（失敗するべき）
const { data, error } = await supabase
  .from("event_logs")
  .select("*");
console.log("SELECT エラー:", error);
// 期待: new row violates row-level security policy ✅

// テスト2: INSERT（成功するべき）
const { data: data2, error: error2 } = await supabase
  .from("event_logs")
  .insert({
    user_id: "自分のLINE User ID",
    event_name: "test_event",
    source: "manual_test",
    metadata: { test: true }
  });
console.log("INSERT 結果:", data2, error2);
// 期待: 成功（errorがnull） ✅

// テスト3: 不正な形式のuser_id（失敗するべき）
const { data: data3, error: error3 } = await supabase
  .from("event_logs")
  .insert({
    user_id: "invalid-format-id",
    event_name: "test_event"
  });
console.log("不正形式 エラー:", error3);
// 期待: new row violates row-level security policy ✅
```

---

## 📊 データ欠損の影響

### 欠損期間

- **開始**: 2026-04-04 9:37:20 (JST)
- **終了**: 修正SQL実行時まで
- **推定欠損時間**: 約21時間

### 欠損データ

- ユーザー行動ログ（app_open, stamp_scan_success など）
- マーケティング分析用データ
- DAU（Daily Active Users）の一部

### 対処

- ❌ **欠損データの復元は不可能**（記録されていないため）
- ✅ 修正後は通常通りログ記録が再開される
- ℹ️ 欠損期間の分析は注意が必要

---

## 🔄 今後の対策

### 1. RLS変更時のチェックリスト

RLSポリシーを変更する際は、以下を確認：

- [ ] LIFFアプリからのINSERTが必要なテーブルか？
- [ ] 既存の動作に影響がないか？
- [ ] テスト環境で動作確認したか？

### 2. モニタリング

以下を定期的に確認：

- event_logsテーブルの最新レコード日時
- 直近24時間のログ件数
- エラーログの確認

### 3. アラート設定（推奨）

Supabaseのモニタリング機能で以下を設定：

- event_logsへのINSERTが24時間ない場合にアラート
- RLSポリシーエラーが多発した場合にアラート

---

## 📝 関連ドキュメント

- [supabase/031_fix_event_logs_rls.sql](../supabase/031_fix_event_logs_rls.sql) - 修正SQL（第1段階）
- [supabase/032_fix_event_logs_insert_policy.sql](../supabase/032_fix_event_logs_insert_policy.sql) - 修正SQL（第2段階・最終版）
- [supabase/026_minimal_rls_hardening.sql](../supabase/026_minimal_rls_hardening.sql) - 問題のあるSQL
- [05_Database_Schema.md](05_Database_Schema.md) - データベース設計書（event_logsのRLS仕様）
- [32_イベントログ設計_ユーザ操作.md](32_イベントログ設計_ユーザ操作.md) - event_logs仕様書
- [63_セキュリティ対策_完全版.md](63_セキュリティ対策_完全版.md) - セキュリティ強化の経緯

---

## ❓ FAQ

### Q1: なぜ今まで気づかなかったのか？

**A**: 管理ダッシュボードは正常に動作していたため。管理側はSERVICE_ROLE_KEYを使用しており、RLSをバイパスして過去のログを読み取れていました。新規ログが記録されていないことに気づくまでに時間がかかりました。

### Q2: データは復元できるか？

**A**: ❌ 不可能です。event_logsはリアルタイムで記録されるため、記録されなかった期間のデータは失われています。

### Q3: この修正で既存の機能に影響はあるか？

**A**: ✅ ありません。修正後は元の動作（セキュリティ強化前と同等）に戻ります。

### Q4: セキュリティレベルは下がるのか？

**A**: ⚠️ わずかに下がりますが、形式チェックは維持されます：
- ✅ 全件取得攻撃: 防御（SELECTは禁止のまま）
- ✅ 不正形式のuser_id: 防御（INSERTに形式チェックあり）
- ⚠️ 正規のLINE User IDが既知の場合: なりすましイベント送信が可能

---

**作成者**: Claude Code
**最終更新**: 2026-04-05 22:45 (JST)
**バージョン**: 2.0（修正完了版）
