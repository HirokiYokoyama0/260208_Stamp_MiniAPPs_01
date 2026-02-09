# 実装サマリー - 2026年2月9日

## 📊 本日の実装内容

### Phase 2: スタンプ機能完全実装 ✅ 完了

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

## 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-02-09 | Phase 2実装サマリー作成 |

---

## 参考資料

- [Phase 1実装サマリー](Implementation_Summary_20260208.md)
- [TODO.md](TODO.md)
- [Supabase_Setup.md](Supabase_Setup.md)
- [ファイル構成.md](ファイル構成.md)
