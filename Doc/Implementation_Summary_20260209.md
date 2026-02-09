# 実装サマリー - 2026年2月9日

## 📊 本日の実装内容

### Phase 2: スタンプ機能完全実装 ✅ 完了
### Phase 2.5: 特典交換システム実装 ✅ 完了

---

## 1. データベース拡張

### 1-1. stamp_historyテーブル作成

**ファイル:** `supabase/002_create_stamp_history_table.sql`

```sql
CREATE TABLE IF NOT EXISTS stamp_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  visit_date TIMESTAMPTZ NOT NULL,
  stamp_number INTEGER NOT NULL,
  stamp_method TEXT DEFAULT 'qr_scan',
  qr_code_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**主要な特徴:**
- 1ユーザー : N個のスタンプ（1:N関係）
- 来院履歴の完全な監査証跡
- QRコードIDで重複防止

**インデックス:**
- `idx_stamp_history_user_id` (user_id)
- `idx_stamp_history_visit_date` (visit_date)
- `idx_stamp_history_user_visit_date` (user_id, visit_date) ※重複チェック用
- `idx_stamp_history_qr_code_id` (qr_code_id)

### 1-2. トリガー関数実装

```sql
CREATE OR REPLACE FUNCTION update_profile_stamp_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET
    stamp_count = (SELECT COUNT(*) FROM stamp_history WHERE user_id = NEW.user_id),
    last_visit_date = (SELECT MAX(visit_date) FROM stamp_history WHERE user_id = NEW.user_id),
    updated_at = NOW()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_profile_stamp_count
AFTER INSERT OR DELETE OR UPDATE ON stamp_history
FOR EACH ROW EXECUTE FUNCTION update_profile_stamp_count();
```

**動作:**
- stamp_history に INSERT/UPDATE/DELETE 時に自動実行
- profiles.stamp_count を自動計算
- profiles.last_visit_date を自動更新

---

## 2. データアーキテクチャ統一（重要）

### 2-1. Single Source of Truth（SSOT）確立

```
【唯一の真実】
profiles.stamp_count ← これがスタンプ数の正解
    ↑
    │ トリガーで自動計算
    │
stamp_history ← 来院イベントを記録
```

### 2-2. データフロー

```
QRスキャン（診察券ページ or スタンプページ）
    ↓
addStamp(userId, qrCodeId)  ← 共通関数
    ↓
POST /api/stamps  ← 共通API
    ↓
stamp_history.INSERT
    ↓
トリガー自動発動
    ↓
profiles.stamp_count++
profiles.last_visit_date 更新
    ↓
両ページで同じ数字が表示される ✅
```

---

## 3. スタンプ登録API実装

### 3-1. エンドポイント

**ファイル:** `app/api/stamps/route.ts`

**エンドポイント:** `POST /api/stamps`

**リクエスト:**
```typescript
{
  userId: string;      // LINEユーザーID
  qrCodeId: string;    // QRコードの値
}
```

**レスポンス:**
```typescript
{
  success: boolean;
  message: string;
  stampCount?: number;
  stampNumber?: number;
  error?: string;
}
```

### 3-2. 重複チェック機能

```typescript
// 同日同QRの重複チェック
const today = new Date().toISOString().split("T")[0];
const { data: existing } = await supabase
  .from("stamp_history")
  .select("id")
  .eq("user_id", userId)
  .eq("qr_code_id", qrCodeId)
  .gte("visit_date", `${today}T00:00:00`)
  .lt("visit_date", `${today}T23:59:59`)
  .maybeSingle();

if (existing) {
  return { success: false, error: "本日すでにスタンプを取得済みです" };
}
```

---

## 4. ユーティリティ関数実装

### 4-1. lib/stamps.ts

**実装した関数:**

| 関数名 | 機能 | データソース |
|-------|------|------------|
| `fetchStampCount(userId)` | スタンプ数取得 | profiles.stamp_count |
| `fetchStampHistory(userId)` | 来院履歴取得 | stamp_history |
| `addStamp(userId, qrCodeId)` | スタンプ登録 | POST /api/stamps |
| `formatStampDate(dateString)` | 日付フォーマット | - |
| `getStampProgress(current, goal)` | 進捗計算 | - |

**重要な設計判断:**
- `fetchStampCount()` は必ず `profiles.stamp_count` を参照
- `stamp_history.length` は使わない（データ不整合を防ぐ）

---

## 5. スタンプページ完全実装

### 5-1. ファイル

**ファイル:** `app/stamp/page.tsx`

### 5-2. 実装した機能

#### スタンプカウンターセクション
```tsx
<p className="text-5xl font-bold text-primary">{stampCount}</p>
<p className="mt-2 text-sm text-gray-500">/ {STAMP_GOAL}個</p>
```

#### プログレスバー
```tsx
<div className="h-full bg-gradient-to-r from-primary to-primary-dark">
  style={{ width: `${progress.percentage}%` }}
</div>
```

#### 来院履歴リスト（カード型デザイン）
```tsx
{stampHistory.map((record) => (
  <li key={record.id}>
    <CheckCircle2 /> {record.stamp_number}回目の来院
    {formatStampDate(record.visit_date)}
  </li>
))}
```

#### QRスキャン機能
```tsx
<QRScanner
  onScan={handleStampScan}
  disabled={isScanning}
>
  {isScanning ? "読み取り中..." : "来院スタンプを読み取る"}
</QRScanner>
```

### 5-3. データ取得の統一

```typescript
// スタンプ履歴とカウント数を取得
const fetchHistory = async () => {
  // スタンプ数は profiles.stamp_count から取得（Single Source of Truth）
  const count = await fetchStampCount(profile.userId);
  setStampCount(count);

  // 履歴は stamp_history から取得
  const history = await fetchStampHistory(profile.userId);
  setStampHistory(history);
};
```

---

## 6. ホームページ（診察券）連携

### 6-1. ファイル

**ファイル:** `app/page.tsx`

### 6-2. 変更内容

```typescript
import { addStamp, fetchStampCount } from "@/lib/stamps";

// QRスキャン時の処理（同じAPI使用）
<QRScanner
  onScan={async (qrValue) => {
    const result = await addStamp(profile.userId, qrValue);
    if (result.success) {
      setStampCount(result.stampCount);
      await fetchUserData(profile.userId);
    }
  }}
/>
```

---

## 7. 型定義

### 7-1. ファイル

**ファイル:** `types/stamp.ts`

```typescript
export interface StampHistoryRecord {
  id: string;
  user_id: string;
  visit_date: string;
  stamp_number: number;
  stamp_method: "qr_scan" | "manual_admin" | "import";
  qr_code_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AddStampResponse {
  success: boolean;
  message: string;
  stampCount?: number;
  stampNumber?: number;
  error?: string;
}

export interface StampProgress {
  percentage: number;
  remaining: number;
  isComplete: boolean;
}
```

---

## 📁 ファイル構成の変更

### 新規追加ファイル

```
supabase/
└── 002_create_stamp_history_table.sql  # stamp_historyテーブル作成SQL

types/
└── stamp.ts                             # スタンプ機能の型定義

app/api/
└── stamps/
    └── route.ts                         # スタンプ登録API

lib/
└── stamps.ts                            # スタンプユーティリティ関数
```

### 更新ファイル

```
app/
├── stamp/page.tsx                       # スタンプページ完全実装
└── page.tsx                             # QRスキャナー連携追加
```

---

## 🛠 技術スタック（更新）

| カテゴリ | 技術 | バージョン |
|---------|------|-----------|
| **Frontend** | Next.js (App Router, Turbopack) | 16.1.6 |
| **React** | React | 19.2.4 |
| **TypeScript** | TypeScript | 5.x |
| **UI** | Tailwind CSS | 3.4.1 |
| **Icons** | Lucide React | 0.460.0 |
| **LINE SDK** | @line/liff | 2.26.1 |
| **Backend/Database** | Supabase | - |
| **Supabase Client** | @supabase/supabase-js | 2.48.1 |
| **API** | Next.js Route Handlers | 16.1.6 |

---

## 🎯 実装した主な機能

### ✅ スタンプ登録機能
- QRコードスキャン → API呼び出し → DB登録
- 重複チェック（同日同QR防止）
- リアルタイム画面更新

### ✅ 来院履歴表示
- 履歴をカード型リストで表示
- 日付順ソート（新しい順）
- スタンプ番号表示

### ✅ 進捗表示
- スタンプ数カウンター（X / 10個）
- プログレスバー（グラデーション）
- 目標達成時の表示（Trophy アイコン）

### ✅ データ統一アーキテクチャ
- Single Source of Truth（profiles.stamp_count）
- トリガー自動更新
- 診察券ページとスタンプページでデータ不整合なし

---

## 🔐 セキュリティ・データ整合性

### Row Level Security (RLS)
```sql
ALTER TABLE stamp_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_public_read" ON stamp_history FOR SELECT USING (true);
CREATE POLICY "allow_public_insert" ON stamp_history FOR INSERT WITH CHECK (true);
```

### データ整合性
- 外部キー制約（`REFERENCES profiles(id) ON DELETE CASCADE`）
- トリガーによる自動計算
- 重複防止機能

### QRコード検証
```typescript
// 空文字列のみチェック（柔軟な実装）
if (!qrCodeId || qrCodeId.trim().length === 0) {
  return { success: false, error: "QRコードの値が無効です" };
}
```

---

## 📊 データフロー図

```
┌─────────────────────────────────────────────┐
│           ユーザー操作                       │
├─────────────────────────────────────────────┤
│  診察券ページ: QRスキャン                   │
│       OR                                     │
│  スタンプページ: QRスキャン                 │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│      共通処理（lib/stamps.ts）              │
│  addStamp(userId, qrCodeId)                 │
│    ↓                                         │
│  fetch("/api/stamps", { POST })             │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│   バックエンド（app/api/stamps/route.ts）   │
│  1. 重複チェック（同日同QR）                │
│  2. stamp_history に INSERT                 │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│      Supabase トリガー（自動実行）          │
│  update_profile_stamp_count()               │
│    ↓                                         │
│  profiles.stamp_count++                     │
│  profiles.last_visit_date = NOW()           │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│          画面更新（両ページ）               │
│  診察券: stamp_count 表示更新               │
│  スタンプ: 履歴リスト再取得                 │
└─────────────────────────────────────────────┘
```

---

## 🚀 デプロイ準備

### 必須作業（Supabase）

1. **テーブル作成**
   ```bash
   # supabase/002_create_stamp_history_table.sql を
   # Supabase SQL Editorで実行
   ```

2. **動作確認**
   ```sql
   SELECT * FROM stamp_history LIMIT 5;
   SELECT tgname FROM pg_trigger WHERE tgrelid = 'stamp_history'::regclass;
   ```

### 必須環境変数（Vercel）

| Variable Name | 説明 |
|--------------|------|
| `NEXT_PUBLIC_LIFF_ID` | LINE LIFF ID |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key |

---

## 📝 Gitコミット履歴（Phase 2）

```
[予定] feat: Phase 2完了 - スタンプ機能完全実装
  - stamp_historyテーブル作成
  - スタンプ登録API実装（POST /api/stamps）
  - 重複チェック機能実装
  - スタンプページUI完全実装
  - データ統一アーキテクチャ確立
  - lib/stamps.ts ユーティリティ関数追加
  - types/stamp.ts 型定義追加
```

---

## 🎯 次のステップ（Phase 3以降）

### Phase 3: ケア記録機能
- デイリーチェックリスト
- セルフケアカレンダー
- ケア習慣の可視化

### Phase 4: ごほうび・ポイント機能
- ポイントシステム実装
- ごほうび交換機能
- 特典内容管理

### Phase 6: LINE Messaging API連携
- QRスキャン時の即時通知
- 予約配信・リマインド機能
- Flex Messageデザイン

---

## 📌 重要な設計判断

### 1. データの一元化
**判断:** `profiles.stamp_count` を唯一の真実（SSOT）とする

**理由:**
- stamp_history.length とprofiles.stamp_count が異なると混乱
- トリガーで自動計算することでデータ整合性を保証
- 両ページで同じ数字が表示される

### 2. QRコードフォーマット
**判断:** 任意の文字列を受け入れる柔軟な実装

**理由:**
- QRコード形式が未定
- 後から正規表現で制限追加可能
- 初期段階では柔軟性を優先

### 3. スタンプ目標数
**判断:** 10個に設定（定数化）

**理由:**
- 標準的なスタンプカードと同じ
- 約3ヶ月（定期検診）で達成可能
- 後から変更可能

### 4. カレンダービュー
**判断:** 実装しない（リスト表示のみ）

**理由:**
- ユーザー要件により不要
- シンプルな実装を優先
- 必要になったら追加可能

---

---

## 8. 特典交換システム実装（Phase 2.5）

### 8-1. データベース拡張

**ファイル:** `supabase/003_create_rewards_tables.sql`

#### テーブル1: rewards（特典マスター）

```sql
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  required_stamps INTEGER NOT NULL,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**初期データ（サンプル特典）:**
- 歯ブラシセット（5個）
- フッ素塗布無料（10個）
- クリーニング半額（15個）
- ホワイトニング30%OFF（20個）

#### テーブル2: reward_exchanges（特典交換履歴）

```sql
CREATE TABLE IF NOT EXISTS reward_exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  stamp_count_used INTEGER NOT NULL,
  exchanged_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**ステータス管理:**
- `pending` - 交換申請済み（受付で提供前）
- `completed` - 提供完了
- `cancelled` - キャンセル

### 8-2. 特典関連API実装

#### API 1: GET /api/rewards

**ファイル:** `app/api/rewards/route.ts`

**機能:** 有効な特典一覧を取得

**レスポンス:**
```typescript
{
  success: boolean;
  rewards: Reward[];
  error?: string;
}
```

#### API 2: POST /api/rewards/exchange

**ファイル:** `app/api/rewards/exchange/route.ts`

**機能:** 特典を交換（スタンプ積み上げ式）

**リクエスト:**
```typescript
{
  userId: string;
  rewardId: string;
}
```

**処理フロー:**
```
1. 特典情報を取得（required_stamps確認）
2. ユーザーのスタンプ数を取得
3. スタンプ数の確認（不足時はエラー）
4. スタンプは減らさない（profiles.stamp_count はそのまま維持）
5. 交換履歴を記録（reward_exchanges に INSERT）
6. 現在のスタンプ数をそのまま返却
```

**スタンプ積み上げ式の動作:**
```
例: 12個貯まった状態で「フッ素塗布無料」(10個) と交換
  ↓
profiles.stamp_count: 12 → 12（減らない！）
  ↓
条件を満たせば何度でも交換可能
  ↓
20個貯まれば5個/10個/15個/20個の特典すべて交換可能
```

### 8-3. ユーティリティ関数

**ファイル:** `lib/rewards.ts`

| 関数名 | 機能 |
|-------|------|
| `fetchRewards()` | 特典一覧を取得 |
| `exchangeReward(userId, rewardId)` | 特典を交換 |
| `addRewardStatus(rewards, stampCount)` | 交換可否の情報を付与 |

### 8-4. 型定義

**ファイル:** `types/reward.ts`

```typescript
export interface Reward {
  id: string;
  name: string;
  description: string | null;
  required_stamps: number;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface RewardWithStatus extends Reward {
  canExchange: boolean;      // 交換可能かどうか
  remainingStamps: number;   // あと何個必要か
}
```

### 8-5. 特典ページ実装

**ファイル:** `app/rewards/page.tsx`

**実装した機能:**

#### 現在のスタンプ数表示
```tsx
<p className="text-4xl font-bold text-primary">{stampCount}個</p>
```

#### 特典一覧（カード型）
```tsx
{rewards.map((reward) => (
  <li className={reward.canExchange ? "border-primary/30 bg-primary/5" : "border-gray-100"}>
    <h3>{reward.name}</h3>
    <p>{reward.description}</p>
    <span>{reward.required_stamps}個で交換</span>
    {reward.canExchange ? (
      <button onClick={() => handleExchange(reward.id, reward.name)}>
        この特典と交換する
      </button>
    ) : (
      <button disabled>スタンプが不足しています（あと{reward.remainingStamps}個）</button>
    )}
  </li>
))}
```

#### 交換処理
```typescript
const handleExchange = async (rewardId: string, rewardName: string) => {
  const confirmed = window.confirm(`「${rewardName}」と交換しますか？`);
  if (!confirmed) return;

  const result = await exchangeReward(profile.userId, rewardId);
  if (result.success) {
    setStampCount(result.newStampCount);
    setRewards((prev) => addRewardStatus(prev, result.newStampCount));
    alert(result.message);
  }
};
```

### 8-6. ボトムナビゲーション拡張（5つ目のメニュー）

**ファイル:** `components/layout/AppLayout.tsx`

**変更内容:**

#### メニュー構成（4つ → 5つ）

```typescript
const TABS = [
  { href: "/", label: "診察券", icon: CreditCard },
  { href: "/stamp", label: "スタンプ", icon: Stamp },
  { href: "/rewards", label: "特典", icon: Gift },      // ← NEW
  { href: "/care", label: "ケア記録", icon: ClipboardCheck },
  { href: "/info", label: "医院情報", icon: Building2 },
];
```

#### UI最適化（5つでも押しやすく）

```tsx
<nav className="fixed bottom-0">
  <div className="flex items-center justify-around px-1 py-2">
    {TABS.map(({ href, label, icon: Icon }) => (
      <Link className="flex flex-1 flex-col items-center gap-1 px-2 py-2">
        <Icon size={20} />  {/* アイコンサイズ 22 → 20 に縮小 */}
        <span className="text-[10px]">{label}</span>  {/* フォントサイズ縮小 */}
      </Link>
    ))}
  </div>
</nav>
```

**最適化ポイント:**
- `flex-1` でタップ領域を均等配分
- アイコンサイズを20pxに縮小
- ラベルを10pxに縮小
- パディングを調整（px-2）

### 8-7. ドキュメント作成

**ファイル:** `Doc/Rewards_System_Specification.md`

**内容:**
- 特典交換システムの概要
- UI設計（ボトムナビゲーション5つ）
- データベース設計
- API仕様
- スタンプ積み上げ式の仕組み
- 運用設計（特典の追加・変更方法）
- セキュリティ設計
- トラブルシューティング
- 今後の拡張案（Phase 3）

---

## 9. スタッフ手動スタンプ機能拡張

### 9-1. 仕様変更

**変更前:** スタッフは1個ずつ追加のみ

**変更後:** スタンプ数を自由に編集可能（+/-ボタン）

#### UIの変更（2ステップ化）

**ステップ1: 認証**
```
暗証番号（4桁）を入力
  ↓
「次へ」ボタン
```

**ステップ2: 編集**
```
現在のスタンプ数: 5個

新しいスタンプ数
[ - ] [ 6 ] [ + ]

変更: +1個

「更新」ボタン
```

### 9-2. API変更

**ファイル:** `app/api/stamps/manual/route.ts`

**変更点:**
- リクエストに `newStampCount` パラメータを追加
- スタンプ数の直接設定が可能に
- 1日1回制限を解除（何度でも変更可能）

**新しいリクエスト:**
```typescript
{
  userId: string;
  staffPin: string;
  newStampCount: number;  // ← NEW
}
```

**処理:**
```typescript
// profiles.stamp_count を直接更新
await supabase
  .from("profiles")
  .update({ stamp_count: newStampCount })
  .eq("id", userId);

// 監査証跡を記録
await supabase.from("stamp_history").insert({
  user_id: userId,
  stamp_method: "manual_admin",
  stamp_number: newStampCount,
  notes: `スタッフ操作: +1個 (5 → 6)`,
});
```

### 9-3. モーダルコンポーネント拡張

**ファイル:** `components/features/StaffPinModal.tsx`

**追加機能:**
- 2ステップUI（認証 → 編集）
- +/-ボタンでスタンプ数を増減
- 変更差分の表示（例: 変更: +1個）
- 範囲制限（0～999個）

**新しいProps:**
```typescript
interface StaffPinModalProps {
  currentStampCount: number;  // ← NEW: 現在のスタンプ数
  onSubmit: (pin: string, newCount: number) => Promise<void>;  // ← 変更
}
```

### 9-4. ドキュメント更新

**ファイル:** `Doc/Staff_Manual_Stamp_Specification.md`

**更新内容:**
- UI仕様を2ステップに更新
- API仕様を新しいパラメータに対応
- 操作手順を詳細化
- 制限事項を更新（1日1回制限解除）
- 改訂履歴追加（v2.0）

---

## 10. バージョン管理自動化

### 10-1. Gitタグ連携

**ファイル:** `next.config.mjs`, `scripts/update-version.mjs`

**機能:**
- Gitタグから自動的にバージョン番号を取得
- package.jsonのversionを自動更新
- ビルド時に環境変数として埋め込み

**動作:**
```bash
git tag v1.0.1
npm run build
  ↓
prebuild: update-version.mjs が実行される
  ↓
package.json の version が "1.0.1" に更新
  ↓
next.config.mjs がタグから "1.0.1" を取得
  ↓
NEXT_PUBLIC_APP_VERSION=1.0.1 として埋め込み
```

**表示:**
```
フッター: v1.0.1 • dev
```

### 10-2. ドキュメント作成

**ファイル:** `Doc/Version_Management.md`

**内容:**
- バージョン表示の仕組み
- バージョンアップの手順
- Semantic Versioning規則
- 自動化の仕組み
- トラブルシューティング

---

## 📁 ファイル構成の変更（追加分）

### 新規追加ファイル（特典システム）

```
supabase/
└── 003_create_rewards_tables.sql        # rewardsテーブル作成SQL

types/
└── reward.ts                             # 特典機能の型定義

app/api/rewards/
├── route.ts                              # 特典一覧取得API
└── exchange/
    └── route.ts                          # 特典交換API

app/rewards/
└── page.tsx                              # 特典ページ

lib/
└── rewards.ts                            # 特典ユーティリティ関数

Doc/
├── Rewards_System_Specification.md       # 特典システム仕様書
└── Version_Management.md                 # バージョン管理運用ガイド

scripts/
└── update-version.mjs                    # バージョン自動更新スクリプト
```

### 更新ファイル

```
components/layout/
└── AppLayout.tsx                         # ボトムナビゲーション（5つに拡張）

components/features/
└── StaffPinModal.tsx                     # 2ステップUI、+/-ボタン追加

app/api/stamps/manual/
└── route.ts                              # スタンプ数直接設定機能

app/
└── page.tsx                              # StaffPinModal連携

next.config.mjs                           # Gitタグ自動取得

package.json                              # prebuildフック追加

Doc/
└── Staff_Manual_Stamp_Specification.md   # v2.0に更新
```

---

## 🎯 実装した主な機能（追加分）

### ✅ 特典交換システム
- 特典マスターのデータベース管理
- 特典一覧の表示
- スタンプ積み上げ式の交換機能（スタンプは減らない）
- 交換履歴の記録
- 交換可否の自動判定

### ✅ ボトムナビゲーション拡張
- 5つのメニュー対応
- タップ領域の最適化
- 視認性の確保

### ✅ スタッフ機能強化
- スタンプ数を自由に編集
- +/-ボタンで増減
- 1日1回制限解除
- 監査証跡の詳細化

### ✅ バージョン管理自動化
- Gitタグからバージョン自動取得
- package.json自動更新
- ビルド時の自動埋め込み

---

## 📊 データフロー図（特典交換）

```
┌─────────────────────────────────────────────┐
│       ユーザー操作（特典ページ）            │
│  「この特典と交換する」ボタンをタップ       │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│     確認ダイアログ                          │
│  「交換しますか？」 → 「はい」              │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│   exchangeReward(userId, rewardId)          │
│     ↓                                        │
│   POST /api/rewards/exchange                │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│   バックエンド処理                          │
│  1. 特典情報取得（required_stamps確認）     │
│  2. ユーザーのスタンプ数確認                │
│  3. スタンプ数チェック（不足時はエラー）    │
│  4. profiles.stamp_count を減算             │
│     例: 10個 → 0個                          │
│  5. reward_exchanges に交換履歴記録         │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│          画面更新                           │
│  スタンプ数: 10個 → 0個                    │
│  特典の状態: 交換可能 → 不足               │
│  成功メッセージ表示                         │
└─────────────────────────────────────────────┘
```

---

## 🚀 デプロイ準備（追加作業）

### Supabaseで実行するSQL

1. **特典テーブル作成**
   ```bash
   # supabase/003_create_rewards_tables.sql を
   # Supabase SQL Editorで実行
   ```

2. **動作確認**
   ```sql
   SELECT * FROM rewards;
   SELECT * FROM reward_exchanges;
   ```

### 環境変数（追加）

| Variable Name | 説明 | デフォルト |
|--------------|------|-----------|
| `NEXT_PUBLIC_STAFF_PIN` | スタッフ暗証番号（4桁） | 1234 |
| `NEXT_PUBLIC_APP_VERSION` | アプリバージョン | 自動取得 |

---

## 📝 Gitコミット履歴（Phase 2.5追加分）

```
[予定] feat: Phase 2.5完了 - 特典交換システム実装
  - rewardsテーブル、reward_exchangesテーブル作成
  - 特典一覧取得API実装（GET /api/rewards）
  - 特典交換API実装（POST /api/rewards/exchange）
  - スタンプ積み上げ式システム実装（交換後もスタンプは減らない）
  - 特典ページUI実装（app/rewards/page.tsx）
  - ボトムナビゲーション5つに拡張
  - スタッフ手動スタンプ機能強化（+/-ボタン、1日制限解除）
  - バージョン管理自動化（Gitタグ連携）
  - lib/rewards.ts ユーティリティ関数追加
  - types/reward.ts 型定義追加
  - ドキュメント追加（Rewards_System_Specification.md）
  - ドキュメント追加（Version_Management.md）
```

---

## 🎯 次のステップ（Phase 3以降）更新

### Phase 3: ケア記録機能
- デイリーチェックリスト
- セルフケアカレンダー
- ケア習慣の可視化

### ~~Phase 4: ごほうび・ポイント機能~~ ✅ 完了（Phase 2.5）
- ~~ポイントシステム実装~~ → 特典交換システムとして実装完了
- ~~ごほうび交換機能~~ → スタンプ積み上げ式で実装完了
- ~~特典内容管理~~ → rewardsテーブルで管理可能

### Phase 5: 特典システム拡張（オプション）
- 特典画像のアップロード
- 在庫管理機能
- 交換履歴ページ
- 有効期限設定
- プッシュ通知

### Phase 6: LINE Messaging API連携
- QRスキャン時の即時通知
- 予約配信・リマインド機能
- Flex Messageデザイン

---

## 📌 重要な設計判断（追加分）

### 5. ボトムナビゲーション5つ
**判断:** 診察券、スタンプ、特典、ケア記録、医院情報の5つ

**理由:**
- 「溜める楽しさ」（スタンプ）と「使う楽しみ」（特典）を分離
- ユーザーの再来院モチベーション向上
- モバイルUIの標準的な範囲内（3～5個推奨）

**UI最適化:**
- アイコンサイズ縮小（22px → 20px）
- ラベル縮小（12px → 10px）
- タップ領域の均等配分（flex-1）

### 6. スタンプ積み上げ式
**判断:** 特典交換時にスタンプは減らない（例: 12個 → 12個のまま）

**理由:**
- 条件を満たせば何度でも特典交換可能
- 再来院のモチベーション向上（貯めた達成感を維持）
- ユーザーフレンドリーで満足度が高い
- 20個貯まれば5個/10個/15個/20個の特典すべて交換可能

**仕様変更の経緯:**
- 当初は消費型（10個 → 0個）で実装
- ユーザー要望により積み上げ式に変更（2026-02-09）

### 7. スタッフ機能の柔軟化
**判断:** +/-ボタンでスタンプ数を自由に編集、1日1回制限解除

**理由:**
- QR読み取り失敗時の柔軟な対応
- 誤登録の修正が可能
- データ不整合の修正が可能
- 監査証跡は完全に記録（stamp_history）

---

## 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-02-09 | Phase 2実装サマリー作成 |
| 2026-02-09 | Phase 2.5追加（特典交換システム、ボトムナビ5つ、スタッフ機能強化、バージョン管理自動化） |

---

## 参考資料

- [Phase 1実装サマリー](Implementation_Summary_20260208.md)
- [TODO.md](TODO.md)
- [Supabase_Setup.md](Supabase_Setup.md)
- [ファイル構成.md](ファイル構成.md)
- [Rewards_System_Specification.md](Rewards_System_Specification.md)  ← NEW
- [Staff_Manual_Stamp_Specification.md](Staff_Manual_Stamp_Specification.md)
- [Version_Management.md](Version_Management.md)  ← NEW
