# 【緊急連絡】管理ダッシュボードへ - `available`ステータス導入に伴う修正依頼

**作成日**: 2026-04-04
**優先度**: 🔴 **緊急** - 特典確認画面でエラー発生中
**関連**: LIFFアプリ側で `available` ステータスを導入

---

## 1. 問題の概要

LIFFアプリ側で `reward_exchanges.status` に **`available`** ステータスを追加しました。

これにより、管理ダッシュボードの特典確認画面でエラーが発生していると報告を受けました。

---

## 2. データベース変更内容

### 2.1 `reward_exchanges.status` の変更

#### Before（旧仕様）
```
status: 'pending' | 'completed' | 'cancelled' | 'expired'
```

#### After（新仕様） ✅
```
status: 'available' | 'pending' | 'completed' | 'cancelled' | 'expired'
```

### 2.2 CHECK制約の更新

Supabaseで以下のマイグレーションを実行済み:

```sql
-- 028_add_available_status.sql（実行済み ✅）
ALTER TABLE reward_exchanges
DROP CONSTRAINT IF EXISTS reward_exchanges_status_check;

ALTER TABLE reward_exchanges
ADD CONSTRAINT reward_exchanges_status_check
CHECK (status IN ('available', 'pending', 'completed', 'cancelled', 'expired'));
```

### 2.3 既存データの更新

既存のマイルストーン特典（約13件）を `pending` → `available` に更新済み:

```sql
-- 029_update_pending_to_available.sql（実行済み ✅）
UPDATE reward_exchanges
SET
  status = 'available',
  notes = COALESCE(notes || ' ', '') || '【修正】初期ステータスをavailableに変更',
  updated_at = NOW()
WHERE
  is_milestone_based = true
  AND status = 'pending';
```

---

## 3. ステータスフローの仕様

### 3.1 新しいステータスフロー

| ステータス | 意味 | タイミング | 管理画面での表示 |
|----------|------|----------|----------------|
| **`available`** 🆕 | マイルストーン到達済み | マイルストーン到達時に自動付与 | **「交換可能」** または **「未申請」** |
| `pending` | ユーザーが交換申請済み | ユーザーが「この特典と交換する」をタップ | 「申請中」 |
| `completed` | 受付で特典提供完了 | スタッフが特典を提供 | 「提供完了」 |
| `cancelled` | キャンセル済み | スタッフがキャンセル操作 | 「キャンセル」 |
| `expired` | 有効期限切れ | 有効期限を過ぎた | 「期限切れ」 |

### 3.2 正しい遷移フロー

```
available（マイルストーン到達）
  ↓
pending（ユーザーが交換ボタンをタップ）
  ↓
completed（スタッフが特典提供）
```

または

```
available → cancelled（スタッフがキャンセル）
pending → cancelled（スタッフがキャンセル）
pending → expired（有効期限切れ）
```

---

## 4. 管理ダッシュボード側で必要な修正

### 4.1 TypeScript型定義の修正

```typescript
// Before
type RewardExchangeStatus = 'pending' | 'completed' | 'cancelled' | 'expired';

// After ✅
type RewardExchangeStatus = 'available' | 'pending' | 'completed' | 'cancelled' | 'expired';
```

### 4.2 特典一覧画面での表示

`status = 'available'` の場合の表示を追加してください:

```typescript
const getStatusLabel = (status: RewardExchangeStatus) => {
  switch (status) {
    case 'available':  // 🆕 追加
      return '交換可能（未申請）';
    case 'pending':
      return '申請中';
    case 'completed':
      return '提供完了';
    case 'cancelled':
      return 'キャンセル';
    case 'expired':
      return '期限切れ';
    default:
      return '不明';
  }
};
```

### 4.3 ステータスフィルタ

フィルタに `available` を追加してください:

```typescript
const statusFilters = [
  { value: 'all', label: 'すべて' },
  { value: 'available', label: '交換可能（未申請）' },  // 🆕 追加
  { value: 'pending', label: '申請中' },
  { value: 'completed', label: '提供完了' },
  { value: 'cancelled', label: 'キャンセル' },
  { value: 'expired', label: '期限切れ' },
];
```

### 4.4 ステータス変更機能

`available` から `pending` / `cancelled` への変更を許可してください:

```typescript
// available の場合に許可する遷移先
if (currentStatus === 'available') {
  allowedTransitions = ['pending', 'cancelled'];
}
```

---

## 5. エラーの可能性

### 5.1 想定されるエラー

管理ダッシュボードで発生している可能性が高いエラー:

#### (1) TypeScriptコンパイルエラー
```
Type '"available"' is not assignable to type 'RewardExchangeStatus'
```

**原因**: 型定義に `'available'` が含まれていない

**修正**: 4.1の型定義を追加

#### (2) switch文での未処理エラー
```typescript
switch (status) {
  case 'pending': ...
  case 'completed': ...
  // 'available' が処理されていない → default に落ちる
}
```

**原因**: `available` ケースが未実装

**修正**: 4.2のように `case 'available':` を追加

#### (3) データベースクエリエラー
```sql
WHERE status IN ('pending', 'completed', 'cancelled', 'expired')
-- 'available' が含まれていない → available レコードが取得できない
```

**原因**: WHERE句に `'available'` が含まれていない

**修正**: `'available'` を追加

---

## 6. 確認していただきたいこと

### 6.1 エラーログの確認

管理ダッシュボードのエラーログ（ブラウザコンソールまたはサーバーログ）を確認してください:

- エラーメッセージの全文
- エラーが発生しているファイル名と行番号
- スタックトレース

### 6.2 影響範囲の確認

以下の画面で `status` を使用している箇所をすべて確認してください:

- 特典一覧画面
- 特典詳細画面
- ステータス変更機能
- フィルタ機能
- レポート画面

---

## 7. LIFFアプリ側の変更内容（参考）

### 7.1 変更ファイル

1. **types/reward.ts**
   - `status` に `'available'` を追加

2. **lib/milestones.ts**
   - `grantMilestoneReward()`: 初期ステータスを `'available'` に変更
   - `invalidateMilestoneRewards()`: `'available'` も無効化対象に追加

3. **components/(adult)/AdultRewardsPage.tsx**
   - `isAvailable` フラグを追加
   - ボタンロジックで `isAvailable` を最優先チェック

### 7.2 変更理由

**問題**: 外部カメラQRスキャン時、マイルストーン特典が「受付で確認中」と表示されていた

**根本原因**: マイルストーン到達時に `status = 'pending'` で作成していた

**解決策**:
- マイルストーン到達時 → `status = 'available'`（「この特典と交換する」ボタン表示）
- ユーザーがボタンをタップ → `status = 'pending'`（「受付で確認中」表示）

---

## 8. 修正後の動作確認

管理ダッシュボード側で修正後、以下を確認してください:

### 8.1 特典一覧画面
- [ ] `status = 'available'` のレコードが表示される
- [ ] ステータス表示が「交換可能（未申請）」となる
- [ ] フィルタで「交換可能（未申請）」を選択できる

### 8.2 特典詳細画面
- [ ] `status = 'available'` の詳細が表示される
- [ ] ステータス変更で `pending` / `cancelled` に変更できる

### 8.3 既存データ
- [ ] 既存の13件が `available` として表示される
- [ ] notes に「【修正】初期ステータスをavailableに変更」が追加されている

---

## 9. 質問・不明点

以下について教えてください:

1. **エラーの詳細**
   - エラーメッセージの全文
   - エラーが発生している画面・ファイル

2. **使用している技術スタック**
   - TypeScript / JavaScript
   - フレームワーク（React / Vue / Next.js など）
   - ステート管理（Redux / Zustand など）

3. **修正の優先度**
   - 緊急修正が必要か？
   - LIFFアプリ側で一時的にロールバックすべきか？

---

## 10. 連絡先

LIFFアプリ開発者（私）に質問がある場合は、以下を教えてください:

- エラーログの全文
- 該当コードのスクリーンショット
- 修正方針の相談

必要であれば、LIFFアプリ側を一時的にロールバックすることも可能です。

---

## 11. 関連ドキュメント

- [Doc 114: availableステータス導入_実装完了レポート](./114_availableステータス導入_実装完了レポート.md)
- [Doc 55: 特典システム_マイルストーン型_実装完了](./55_特典システム_マイルストーン型_実装完了.md)
- [Doc 60: マイルストーン型特典_実装完了レポート](./60_マイルストーン型特典_実装完了レポート.md)

---

## 12. まとめ

### 変更内容
✅ `reward_exchanges.status` に `'available'` ステータスを追加
✅ 既存のマイルストーン特典（約13件）を `pending` → `available` に更新

### 管理ダッシュボード側で必要な対応
🔴 型定義に `'available'` を追加
🔴 ステータス表示ロジックに `'available'` ケースを追加
🔴 フィルタに「交換可能（未申請）」を追加
🔴 ステータス変更で `available` → `pending` / `cancelled` を許可

### 緊急度
🔴 **高**: 特典確認画面でエラーが発生中 → 早急な修正が必要

---

**作成者**: LIFFアプリ開発者
**更新日時**: 2026-04-04
