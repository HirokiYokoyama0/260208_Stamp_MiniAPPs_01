# ⚠️ 023マイグレーション実行前の確認事項

**作成日:** 2026-03-27
**ステータス:** 実行前確認

---

## 📋 実行による影響

### 無効化されるデータ

#### 1. 特典交換履歴（7件）

すべての既存の特典交換履歴に「[旧仕様] マイルストーン型移行のため無効化」が追記されます。

**completed（引渡済み）**: 5件
- U5c70cd61f4fe89a65381cd7becee8de3: オリジナル歯ブラシセット（2/14）
- U5c70cd61f4fe89a65381cd7becee8de3: フッ素塗布1回無料券（2/14）
- Ua32cbf4d799f189ff999c00a75d29599: オリジナル歯ブラシセット（3/13）
- U4d3e057b29efaf6bb40165b84171e24a: オリジナル歯ブラシセット（3/21）

**cancelled（キャンセル済み）**: 1件
- U5c70cd61f4fe89a65381cd7becee8de3: オリジナル歯ブラシセット（2/10）

**pending（未引渡）**: 2件 ⚠️
- Ua32cbf4d799f189ff999c00a75d29599: フッ素塗布1回無料券（3/26）
- U5c70cd61f4fe89a65381cd7becee8de3: 歯のクリーニング50%OFF券（3/26）

#### 2. 特典マスター（4件）

すべての特典が `is_active = false` に変更されます。

- オリジナル歯ブラシセット
- フッ素塗布1回無料券
- 歯のクリーニング50%OFF券
- ホワイトニング1回30%OFF券

---

## ⚠️ 実行前の必須作業

### 1. バックアップ取得

```bash
# Supabaseダッシュボードから手動バックアップ
# または以下のコマンド
pg_dump [接続文字列] > backup_before_023_$(date +%Y%m%d).sql
```

### 2. ユーザーへの通知（推奨）

**pending状態の2名のユーザーに連絡:**

```
お知らせ：特典システムの変更について

いつもつくばホワイト歯科をご利用いただきありがとうございます。

2026年3月27日より、特典システムが新しくなります。
現在お持ちの特典は [日付] までにご利用ください。

新システムでは、スタンプ10個、50個、300個到達時に
自動的に特典をプレゼントいたします🎁

ご不明な点がございましたら、受付までお問い合わせください。
```

### 3. 移行ボーナスの準備（オプション）

既存ユーザーへの移行ボーナス付与を検討してください。

---

## ✅ 実行手順

### Step 1: Supabase SQL Editorにアクセス

1. https://supabase.com/dashboard にログイン
2. プロジェクト「TsukubaDental」を選択
3. 左メニュー「SQL Editor」をクリック

### Step 2: 023マイグレーションSQLをコピー

`supabase/023_clean_migration_to_milestone.sql` の内容をすべてコピー

### Step 3: SQL Editorに貼り付けて実行

1. 「New query」をクリック
2. SQLを貼り付け
3. **実行前に再確認:**
   - [ ] バックアップ取得済み
   - [ ] pendingユーザーに通知済み（または不要と判断）
   - [ ] ロールバック手順を確認済み
4. 「Run」をクリック

### Step 4: 実行結果の確認

```sql
-- 1. reward_exchangesに無効化メッセージが追記されたか確認
SELECT user_id, notes, status
FROM reward_exchanges
WHERE notes LIKE '%旧仕様%'
LIMIT 5;

-- 2. rewardsが無効化されたか確認
SELECT name, is_active
FROM rewards;

-- 3. milestone_rewardsが正常に作成されたか確認
SELECT name, milestone_type, validity_months
FROM milestone_rewards
ORDER BY display_order;
```

---

## 🔙 ロールバック手順

問題が発生した場合、以下のSQLで元に戻せます：

```sql
-- 1. notesから無効化メッセージを削除
UPDATE reward_exchanges
SET notes = REPLACE(notes, E'\n[旧仕様] マイルストーン型移行のため無効化', '')
WHERE notes LIKE '%旧仕様%';

-- 2. rewardsを再有効化
UPDATE rewards
SET is_active = true;

-- 3. 新規テーブルを削除（必要に応じて）
-- DROP TABLE IF EXISTS milestone_history CASCADE;
-- DROP TABLE IF EXISTS milestone_rewards CASCADE;
```

---

## 📞 問題発生時の連絡先

- **技術的問題:** ダッシュボード開発チーム
- **ユーザー対応:** 受付スタッフ

---

**最終確認日:** 2026-03-27
**確認者:** Claude Code
