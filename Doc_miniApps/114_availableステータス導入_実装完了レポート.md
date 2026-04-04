# available ステータス導入 - 実装完了レポート

**作成日**: 2026-04-04
**ステータス**: ✅ コード実装完了、データベースマイグレーション待ち

---

## 1. 問題の発見

### 1.1 報告されたバグ

外部カメラのQRコードスキャン時、マイルストーン特典が**「受付で確認中」**と表示される問題が発生。

**期待される動作**:
- マイルストーン到達時 → **「この特典と交換する」**ボタンが表示される
- ユーザーがボタンをタップ → **「受付で確認中」**に変わる

**実際の動作**:
- マイルストーン到達直後から**「受付で確認中」**と表示される（バグ）

### 1.2 根本原因

[lib/milestones.ts:206](lib/milestones.ts#L206) の `grantMilestoneReward()` 関数で、初期ステータスが `'pending'` になっていた。

```typescript
// ❌ 間違い（バグの原因）
status: 'pending',  // マイルストーン到達時の初期状態（誤り）

// ✅ 正しい
status: 'available',  // マイルストーン到達時の初期状態（正しい）
```

---

## 2. ステータス仕様の確認

### 2.1 正しいステータスフロー

| ステータス | 意味 | 表示 | 遷移元 |
|----------|------|------|--------|
| `available` | マイルストーン到達済み | 「この特典と交換する」ボタン | - |
| `pending` | ユーザーが交換申請済み | 「受付で確認中...」 | available |
| `completed` | 受付で提供完了 | 「交換完了」 | pending |
| `cancelled` | キャンセル済み | 「キャンセル済み」 | available, pending |
| `expired` | 有効期限切れ | 「有効期限切れ」 | pending |

### 2.2 なぜ以前は動いていたのか？

UI側のボタンロジックが `reward.canExchange`（スタンプ数のみで判定）を使っていたため、statusに関わらず「この特典と交換する」ボタンが表示されていた。

しかし、これは**偶然の動作**であり、正しいステータス管理ではなかった。

**問題点**:
- pending状態でもボタンが表示される = 重複申請の可能性
- ステータスと表示が一致しない = バグの温床

---

## 3. 実装内容

### 3.1 型定義の更新

**ファイル**: [types/reward.ts:45](types/reward.ts#L45)

```typescript
// Before
status: "pending" | "completed" | "cancelled" | "expired";

// After
status: "available" | "pending" | "completed" | "cancelled" | "expired";
```

### 3.2 マイルストーン特典付与時の初期ステータス修正

**ファイル**: [lib/milestones.ts:206](lib/milestones.ts#L206)

```typescript
const { data: exchange, error: exchangeError } = await supabase
  .from('reward_exchanges')
  .insert({
    user_id: userId,
    reward_id: reward.id,
    milestone_reached: milestone,
    status: 'available', // ✅ 修正: pending → available
    valid_until: validUntil,
    is_first_time: isFirstTime,
    is_milestone_based: true,
    stamp_count_used: milestone,
    notes: `${milestone}スタンプ到達で自動付与`,
    exchanged_at: new Date().toISOString()
  })
```

### 3.3 スタンプ減少時の無効化処理

**ファイル**: [lib/milestones.ts:344, 363](lib/milestones.ts#L344)

```typescript
// UPDATE前に対象レコードを確認
const { data: targetRewards } = await supabase
  .from('reward_exchanges')
  .select('id, milestone_reached, status')
  .eq('user_id', userId)
  .eq('is_milestone_based', true)
  .in('milestone_reached', milestoneArray)
  .in('status', ['available', 'pending', 'completed']);  // ✅ available を追加

// ...

// reward_exchanges をソフトデリート（status = 'cancelled'）
const { data, error } = await supabase
  .from('reward_exchanges')
  .update({
    status: 'cancelled',
    notes: `スタッフ操作により無効化 (${oldStampCount} → ${newStampCount})`,
    updated_at: new Date().toISOString()
  })
  .eq('user_id', userId)
  .eq('is_milestone_based', true)
  .in('milestone_reached', milestoneArray)
  .in('status', ['available', 'pending', 'completed'])  // ✅ available を追加
```

### 3.4 UI コンポーネントの更新

**ファイル**: [components/(adult)/AdultRewardsPage.tsx](components/(adult)/AdultRewardsPage.tsx)

#### (1) インターフェース定義

```typescript
interface MilestoneRewardWithStatus extends MilestoneReward {
  canExchange: boolean;
  isAvailable: boolean;  // ✅ 追加
  isPending: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
  isExpired: boolean;
  latestExchange: RewardExchange | null;
  nextMilestone: number;
  validUntil: string | null;
  daysRemaining: number | null;
}
```

#### (2) ステータス判定ロジック

```typescript
// ステータスを先に判定
const isAvailable = latestExchange?.status === 'available';  // ✅ 追加
const isPending = latestExchange?.status === 'pending';
const isCompleted = latestExchange?.status === 'completed';
const isCancelled = latestExchange?.status === 'cancelled';
const isExpiredStatus = latestExchange?.status === 'expired';
```

#### (3) ボタン表示ロジック

```typescript
{reward.isExpired ? (
  <button disabled>有効期限切れ</button>
) : reward.isCompleted ? (
  <button disabled>交換完了</button>
) : reward.isCancelled ? (
  <button disabled>キャンセル済み</button>
) : reward.isAvailable ? (  // ✅ 最優先でチェック
  <button onClick={...}>この特典と交換する</button>
) : reward.isPending ? (
  <button disabled>受付で確認中...</button>
) : reward.canExchange ? (
  <button onClick={...}>この特典と交換する</button>  // フォールバック
) : (
  <button disabled>スタンプが不足しています</button>
)}
```

#### (4) カード背景色・アイコン

```typescript
// カード背景色（line 523）
reward.isAvailable
  ? "border-primary/30 bg-primary/5"
  : reward.isPending
  ? "border-yellow-300 bg-yellow-50"

// アイコン背景色（line 542）
reward.isAvailable
  ? "bg-primary/20"
  : reward.isPending
  ? "bg-yellow-200"

// アイコン種類（line 561）
reward.isAvailable ? (
  <CheckCircle2 className="text-primary" />
) : reward.isPending ? (
  <Clock className="text-yellow-600" />
)
```

---

## 4. データベースマイグレーション

### 4.1 CHECK制約の更新

**ファイル**: [supabase/028_add_available_status.sql](supabase/028_add_available_status.sql)

```sql
-- 既存のCHECK制約を削除
ALTER TABLE reward_exchanges
DROP CONSTRAINT IF EXISTS reward_exchanges_status_check;

-- 新しいCHECK制約を追加（'available'を含む）
ALTER TABLE reward_exchanges
ADD CONSTRAINT reward_exchanges_status_check
CHECK (status IN ('available', 'pending', 'completed', 'cancelled', 'expired'));
```

**実行順序**: ⚠️ **このSQLを先に実行すること**

### 4.2 既存データの更新

**ファイル**: [supabase/029_update_pending_to_available.sql](supabase/029_update_pending_to_available.sql)

```sql
-- 既存のマイルストーン特典で pending 状態のものを available に更新
UPDATE reward_exchanges
SET
  status = 'available',
  notes = COALESCE(notes || ' ', '') || '【修正】初期ステータスをavailableに変更',
  updated_at = NOW()
WHERE
  is_milestone_based = true
  AND status = 'pending';
```

**実行順序**: ⚠️ **028の後に実行すること**

---

## 5. マイグレーション手順

### 5.1 Supabaseでの実行手順

1. Supabase SQL Editor を開く
2. `028_add_available_status.sql` の内容をコピー&ペースト → **実行**
3. エラーがないことを確認
4. `029_update_pending_to_available.sql` の内容をコピー&ペースト → **実行**
5. 更新件数を確認（約13件のはず）

### 5.2 動作確認

```javascript
// 1. available ステータスでINSERT可能か確認
const { data, error } = await supabase
  .from('reward_exchanges')
  .insert({
    user_id: 'U5c70cd61f4fe89a65381cd7becee8de3',
    reward_id: '44bf5e16-e3e5-4154-bf04-ad6bf3c5f0e4',
    milestone_reached: 999,
    status: 'available',  // ← これがエラーにならないこと
    is_milestone_based: true,
    stamp_count_used: 999,
    notes: 'availableステータステスト',
    exchanged_at: new Date().toISOString()
  });

// 2. 既存のpending特典がavailableに更新されたか確認
const { data: milestones } = await supabase
  .from('reward_exchanges')
  .select('*')
  .eq('is_milestone_based', true)
  .eq('status', 'available');

console.log('available状態のマイルストーン特典:', milestones.length);
```

---

## 6. 影響範囲

### 6.1 新規マイルストーン特典

✅ 今後のマイルストーン特典は自動的に `available` で作成される

### 6.2 既存のマイルストーン特典

⚠️ 既存の13件は `pending` → `available` に更新される

**注意**: 実際にユーザーが「交換する」ボタンを押していた場合も `available` に戻ってしまう

**対策**: 管理ダッシュボードで確認し、本当に `pending` であるべきものは手動で戻す

### 6.3 UI表示の変化

| 状態 | Before | After |
|------|--------|-------|
| マイルストーン到達直後 | 「受付で確認中...」（バグ） | 「この特典と交換する」（正しい） ✅ |
| ユーザーが交換ボタンをタップ後 | 「受付で確認中...」（正しい） | 「受付で確認中...」（変わらず） ✅ |
| 受付で提供完了後 | 「交換完了」（正しい） | 「交換完了」（変わらず） ✅ |

---

## 7. テスト計画

### 7.1 単体テスト

- [x] TypeScript型定義の更新（コンパイルエラーなし）
- [ ] データベースCHECK制約の更新（028実行後）
- [ ] 既存データの更新（029実行後）

### 7.2 統合テスト

- [ ] 外部カメラQRスキャン → マイルストーン到達 → `available`で作成される
- [ ] 「この特典と交換する」ボタンが表示される
- [ ] ボタンをタップ → `pending`に変わる
- [ ] 「受付で確認中...」と表示される

### 7.3 本番環境テスト

- [ ] Vercelデプロイ後、実機でQRスキャン
- [ ] マイルストーン特典の表示確認
- [ ] 交換フロー全体の動作確認

---

## 8. ドキュメント更新

### 8.1 更新が必要なドキュメント

- [ ] [Doc 55: 特典システム_マイルストーン型_実装完了](./55_特典システム_マイルストーン型_実装完了.md)
- [ ] [Doc 60: マイルストーン型特典_実装完了レポート](./60_マイルストーン型特典_実装完了レポート.md)

### 8.2 新規作成ドキュメント

- [x] [Doc 114: availableステータス導入_実装完了レポート](./114_availableステータス導入_実装完了レポート.md)（このファイル）

---

## 9. 関連コミット

- `9f8df75` - feat: 'available'ステータスを導入してマイルストーン特典の初期状態を修正

---

## 10. 次のステップ

1. **Supabaseでマイグレーション実行** ⚠️ 最優先
   - 028_add_available_status.sql を実行
   - 029_update_pending_to_available.sql を実行

2. **動作確認**
   - available ステータスでINSERT可能か確認
   - 既存データが更新されたか確認

3. **Vercelデプロイ**
   - `git push origin main`
   - Vercel自動デプロイ待ち

4. **実機テスト**
   - 外部カメラQRスキャン
   - マイルストーン到達時の表示確認
   - 交換フロー全体の確認

5. **ドキュメント更新**
   - Doc 55, 60 のステータスフロー図を更新

---

## 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-04-04 | 初版作成（コード実装完了、データベースマイグレーション待ち） |
