# 特典交換システム 仕様書

## 概要

貯まったスタンプを消費して、特典と交換できるシステム。患者の再来院モチベーション向上を目的とする。

---

## ユーザーフロー

### 通常フロー
```
患者: 来院してスタンプを貯める
  ↓
スタンプが一定数（例: 5個）貯まる
  ↓
患者: 「特典」メニューを開く
  ↓
システム: 現在のスタンプ数と交換可能な特典を表示
  ↓
患者: 好きな特典を選んで「交換」ボタンをタップ
  ↓
システム: 確認ダイアログを表示
  ↓
患者: 「はい」を選択
  ↓
システム: スタンプを消費（10個 → 0個など）
  ↓
システム: 交換完了メッセージを表示
  ↓
受付: 交換履歴を確認し、実際の特典を提供
```

---

## UI設計

### 1. ボトムナビゲーション（5つ）

```
┌─────────────────────────────────────┐
│  つくばホワイト歯科                  │
├─────────────────────────────────────┤
│                                      │
│  [メインコンテンツ]                  │
│                                      │
├─────────────────────────────────────┤
│ [診察券] [スタンプ] [特典] [ケア記録] [医院情報] │
└─────────────────────────────────────┘
```

### 2. 特典ページ

```
┌─────────────────────────────────────┐
│  🎁 特典交換ページ                   │
│  貯まったスタンプで特典と交換できます│
├─────────────────────────────────────┤
│  現在のスタンプ数                    │
│  12個                                │
├─────────────────────────────────────┤
│  交換できる特典                      │
│                                      │
│  ✅ 歯ブラシセット                   │
│  オリジナル歯ブラシ + 歯磨き粉       │
│  [5個で交換]                         │
│  [この特典と交換する]                │
│                                      │
│  ✅ フッ素塗布無料                   │
│  次回来院時にフッ素塗布を無料提供   │
│  [10個で交換]                        │
│  [この特典と交換する]                │
│                                      │
│  🎁 クリーニング半額                 │
│  歯のクリーニングコースを50%OFF     │
│  [15個で交換] [あと3個]              │
│  [スタンプが不足しています]          │
└─────────────────────────────────────┘
```

### 3. 交換確認ダイアログ

```
┌─────────────────────────────────────┐
│  「フッ素塗布無料」と交換しますか？  │
│                                      │
│  この操作は取り消せません。          │
│                                      │
│  [キャンセル]  [交換する]            │
└─────────────────────────────────────┘
```

### 4. 交換完了メッセージ

```
┌─────────────────────────────────────┐
│  フッ素塗布無料と交換しました！      │
│                                      │
│  受付でお申し出ください。            │
└─────────────────────────────────────┘
```

---

## 技術仕様

### 1. データベース設計

#### テーブル1: `rewards`（特典マスター）

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | UUID | 主キー |
| name | TEXT | 特典名（例: 歯ブラシセット） |
| description | TEXT | 詳細説明 |
| required_stamps | INTEGER | 必要なスタンプ数 |
| image_url | TEXT | 特典画像URL（オプション） |
| is_active | BOOLEAN | 有効/無効 |
| display_order | INTEGER | 表示順序 |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

**初期データ（サンプル）:**
```sql
INSERT INTO rewards (name, description, required_stamps, display_order) VALUES
  ('歯ブラシセット', 'オリジナル歯ブラシ + 歯磨き粉サンプル', 5, 1),
  ('フッ素塗布無料', '次回来院時にフッ素塗布を無料で提供', 10, 2),
  ('クリーニング半額', '歯のクリーニングコースを50%OFF', 15, 3),
  ('ホワイトニング30%OFF', 'ホワイトニングコースを30%割引', 20, 4);
```

#### テーブル2: `reward_exchanges`（特典交換履歴）

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | UUID | 主キー |
| user_id | TEXT | ユーザーID（profiles.id） |
| reward_id | UUID | 特典ID（rewards.id） |
| stamp_count_used | INTEGER | 使用したスタンプ数 |
| exchanged_at | TIMESTAMPTZ | 交換日時 |
| status | TEXT | ステータス（pending, completed, cancelled） |
| notes | TEXT | メモ |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

---

### 2. APIエンドポイント

#### エンドポイント1: `GET /api/rewards`
**機能:** 有効な特典一覧を取得

**レスポンス:**
```json
{
  "success": true,
  "rewards": [
    {
      "id": "uuid-1",
      "name": "歯ブラシセット",
      "description": "オリジナル歯ブラシ + 歯磨き粉サンプル",
      "required_stamps": 5,
      "image_url": null,
      "is_active": true,
      "display_order": 1
    }
  ]
}
```

#### エンドポイント2: `POST /api/rewards/exchange`
**機能:** 特典を交換（スタンプ消費型）

**リクエスト:**
```json
{
  "userId": "U1234567890abcdef",
  "rewardId": "uuid-1"
}
```

**レスポンス（成功）:**
```json
{
  "success": true,
  "message": "歯ブラシセットと交換しました！",
  "exchange": {
    "id": "uuid-exchange-1",
    "user_id": "U1234567890abcdef",
    "reward_id": "uuid-1",
    "stamp_count_used": 5,
    "status": "pending"
  },
  "newStampCount": 0
}
```

**レスポンス（スタンプ不足）:**
```json
{
  "success": false,
  "message": "スタンプが不足しています（現在3個、必要5個）",
  "error": "Insufficient stamps"
}
```

---

### 3. スタンプ消費型の仕組み

**動作:**
1. ユーザーが特典交換ボタンをタップ
2. API: 現在のスタンプ数を確認（例: 12個）
3. API: 必要なスタンプ数を確認（例: 10個）
4. API: スタンプ数を減算（12個 → 2個）
5. API: `profiles.stamp_count` を更新
6. API: `reward_exchanges` に交換履歴を記録
7. 画面: 「交換完了」メッセージを表示

**データベース操作:**
```sql
-- スタンプ消費
UPDATE profiles
SET stamp_count = stamp_count - 10
WHERE id = 'U1234567890abcdef';

-- 交換履歴を記録
INSERT INTO reward_exchanges (user_id, reward_id, stamp_count_used, status)
VALUES ('U1234567890abcdef', 'uuid-1', 10, 'pending');
```

---

## 運用設計

### 1. 特典の追加・変更方法

**Supabase SQLエディタで実行:**
```sql
-- 新しい特典を追加
INSERT INTO rewards (name, description, required_stamps, display_order)
VALUES ('歯間ブラシセット', '歯間ブラシ5本セット', 8, 5);

-- 既存特典を変更
UPDATE rewards
SET required_stamps = 12, description = '新しい説明'
WHERE id = 'uuid-1';

-- 特典を無効化（削除せず非表示）
UPDATE rewards
SET is_active = false
WHERE id = 'uuid-1';
```

### 2. 交換履歴の確認

**Supabase SQLエディタで実行:**
```sql
-- 最近の交換履歴を確認
SELECT
  e.exchanged_at,
  p.display_name,
  r.name AS reward_name,
  e.stamp_count_used,
  e.status
FROM reward_exchanges e
JOIN profiles p ON e.user_id = p.id
JOIN rewards r ON e.reward_id = r.id
ORDER BY e.exchanged_at DESC
LIMIT 20;
```

### 3. ステータス管理

| ステータス | 意味 | 運用 |
|-----------|------|------|
| **pending** | 交換申請済み | 受付で特典を提供する前 |
| **completed** | 提供完了 | 受付で実際に特典を渡した後 |
| **cancelled** | キャンセル | 誤交換などの取り消し |

**ステータス更新:**
```sql
-- 特典を提供したら completed に変更
UPDATE reward_exchanges
SET status = 'completed'
WHERE id = 'uuid-exchange-1';
```

---

## セキュリティ設計

### 1. 不正交換の防止

| 対策 | 内容 |
|-----|------|
| **スタンプ数チェック** | API側で必ずスタンプ数を確認 |
| **トランザクション** | スタンプ減算と交換履歴を同時実行（将来実装） |
| **監査証跡** | すべての交換履歴を記録 |

### 2. 監査ログ分析

```sql
-- 不審な交換パターンを検出
-- 例: 同一ユーザーが1日に複数回交換
SELECT
  user_id,
  COUNT(*) AS exchange_count,
  DATE(exchanged_at) AS exchange_date
FROM reward_exchanges
GROUP BY user_id, DATE(exchanged_at)
HAVING COUNT(*) > 3
ORDER BY exchange_count DESC;
```

---

## トラブルシューティング

### Q1: 特典が表示されない

**A:** Supabaseで特典の `is_active` が `true` になっているか確認してください。

```sql
SELECT * FROM rewards WHERE is_active = false;
```

### Q2: 交換後もスタンプが減らない

**A:** APIエラーが発生している可能性があります。コンソールログを確認してください。

### Q3: 誤って交換してしまった

**A:** 以下の手順で取り消せます：
1. スタンプを戻す（スタッフ操作機能を使用）
2. 交換履歴のステータスを `cancelled` に変更

```sql
UPDATE reward_exchanges
SET status = 'cancelled'
WHERE id = 'uuid-exchange-1';
```

---

## 今後の拡張案

### Phase 3: 高度な機能（将来実装）

1. **特典画像のアップロード**
   - 特典ごとに魅力的な画像を表示

2. **在庫管理**
   - 特典の在庫数を管理し、在庫切れを表示

3. **有効期限**
   - 特典に使用期限を設定

4. **交換履歴ページ**
   - ユーザーが自分の交換履歴を確認できる

5. **プッシュ通知**
   - 「あと1個でフッ素塗布と交換できます！」など

---

## 改訂履歴

| 日付 | バージョン | 内容 |
|------|----------|------|
| 2026-02-09 | 1.0 | 初版作成（Phase 2実装完了） |
