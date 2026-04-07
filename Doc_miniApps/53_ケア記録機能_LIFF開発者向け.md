# ケア記録機能 LIFF開発者向け仕様書

**作成日:** 2026-03-07
**最終更新:** 2026-03-07（Supabase直接接続方式に修正）
**対象:** LIFFアプリ開発者
**前提:** [41_ケア記録機能.md](41_ケア記録機能.md) の全体仕様を理解していること
**目的:** LIFF側「My Dental Map」画面の実装に必要な技術仕様を提供する

---

## ⚠️ 重要: データアクセス方式

このプロジェクトでは、**読み取り専用操作はSupabaseに直接接続**します（ハイブリッド型アーキテクチャ）。

```
❌ 間違い: LIFFアプリ → Next.js API → Supabase
✅ 正しい（読み取り）: LIFFアプリ → Supabase Client SDK → Supabase DB
```

**Next.js APIエンドポイントは不要です。** すでに用意されているSupabase RPC関数を直接呼び出してください。

**参考:** [02_ファイル構成.md - アーキテクチャ: データアクセスパターン](02_ファイル構成.md#アーキテクチャ-データアクセスパターンハイブリッド型)

---

## 🔗 既存プロジェクト構造との統合

このケア記録機能は、**既存のボトムナビゲーション「ケア記録」タブ**を拡張します。

- ページパス: `/care` （既存）
- ViewMode対応: `ViewModeContext` 使用（adult/kids切り替え）
- コンポーネント配置: `components/(adult)/AdultCarePage.tsx` と `components/(kids)/KidsCarePage.tsx` を拡張

**参考:** [02_ファイル構成.md:63-64](02_ファイル構成.md#L63-L64)

---

## 📋 目次

1. [概要](#1-概要)
2. [画面構成](#2-画面構成)
3. [Supabase接続とデータ取得](#3-supabase接続とデータ取得)
4. [歯並び図（Odontogram）実装](#4-歯並び図odontogram実装)
5. [治療履歴タイムライン](#5-治療履歴タイムライン)
6. [こどもモード対応](#6-こどもモード対応)
7. [コンポーネント設計](#7-コンポーネント設計)
8. [状態管理](#8-状態管理)
9. [エラーハンドリング](#9-エラーハンドリング)
10. [パフォーマンス最適化](#10-パフォーマンス最適化)
11. [開発手順](#11-開発手順)
12. [参考資料](#12-参考資料)
13. [FAQ](#13-faq)

---

## 1. 概要

### 1.1 実装する機能

LIFFアプリに「My Dental Map」画面を追加し、患者が自分の歯の治療状況を視覚的に確認できるようにする。

**主要機能:**
- 現在の歯の状態を色分け表示した歯並び図
- 過去の治療履歴をタイムライン表示
- 各歯の詳細情報表示
- こどもモード（乳歯20本表示）

**技術スタック:**
- React (既存LIFFアプリと同様)
- Supabase Client SDK (`@supabase/supabase-js`)
- SWR (データフェッチ)
- SVG (歯並び図描画)
- TypeScript

---

## 2. 画面構成

### 2.1 ページパス

```
/care
```

**既存のボトムナビゲーションタブ:**
5タブボトムナビの「ケア記録」タブ（既存）を拡張します。新規ページ作成は不要です。

**参考:** [02_ファイル構成.md - app/care/page.tsx](02_ファイル構成.md#L63)

### 2.2 画面レイアウト

```
┌─────────────────────────────────┐
│ ヘッダー: My Dental Map        │
├─────────────────────────────────┤
│                                 │
│  [最新の歯並び図（SVG）]        │
│   - 色分けされた歯のアイコン    │
│   - タップで詳細表示            │
│                                 │
├─────────────────────────────────┤
│ 凡例（Legend）                  │
│ 🟢 治療済み  🟡 経過観察中      │
│ 🔴 治療予定  ⚪ 記録なし        │
├─────────────────────────────────┤
│ 次回予定メモ（あれば）          │
│ 次回は右下の詰め物チェック予定  │
├─────────────────────────────────┤
│ 治療履歴タイムライン            │
│                                 │
│ 📅 2026-03-05                   │
│ スタッフ: 田中先生              │
│ - 右上奥歯（16）虫歯治療        │
│ - 左下前歯（32）歯石除去        │
│                                 │
│ 📅 2026-02-15                   │
│ スタッフ: 鈴木衛生士            │
│ - 全体クリーニング              │
│                                 │
└─────────────────────────────────┘
```

---

## 3. Supabase接続とデータ取得

### 3.1 Supabase Clientの初期化

```typescript
// lib/supabase/client.ts (既存ファイルを使用)
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

### 3.2 利用可能なRPC関数（すでに実装済み）

管理ダッシュボード側で以下の3つのRPC関数を用意しています:

#### 1. `get_latest_dental_record(p_patient_id)`

**用途:** 最新の歯の状態を取得（歯並び図の表示用）

**呼び出し方:**
```typescript
const { data, error } = await supabase.rpc('get_latest_dental_record', {
  p_patient_id: userId // LINE User ID (例: "U1234567890abcdef")
});
```

**返り値:**
```typescript
{
  id: string;                    // UUID
  patient_id: string;            // LINE User ID
  tooth_data: {                  // JSONB
    "16": {
      "status": "cavity_completed",
      "status_label": "虫歯治療",
      "color": "#10b981",        // green
      "updated_at": "2026-03-05T10:30:00Z"
    },
    "32": {
      "status": "scaling_completed",
      "status_label": "歯石除去",
      "color": "#10b981",
      "updated_at": "2026-03-05T10:35:00Z"
    }
    // ... 他の歯
  };
  next_visit_memo: string | null;  // 次回予定メモ（患者に表示）
  recorded_at: string;             // 記録日時
  staff_display_name: string;      // スタッフ名
}
```

**エラー時:** `data` が `null` になる（記録がない場合）

---

#### 2. `get_dental_record_history(p_patient_id, p_limit, p_offset)`

**用途:** 治療履歴一覧を取得（タイムライン表示用）

**呼び出し方:**
```typescript
const { data, error } = await supabase.rpc('get_dental_record_history', {
  p_patient_id: userId,
  p_limit: 20,      // デフォルト20
  p_offset: 0       // デフォルト0
});
```

**返り値:** 配列
```typescript
[
  {
    id: string;
    recorded_at: string;
    staff_display_name: string;
    next_visit_memo: string | null;
    tooth_data: { ... }; // 全ての歯のデータ
  },
  // ...
]
```

**タイムライン表示用の加工が必要:**

RPC関数は `tooth_data` の生データを返すので、表示用に「どの歯を治療したか」を抽出する必要があります。

```typescript
function extractChanges(toothData: any): HistoryChange[] {
  return Object.entries(toothData || {}).map(([toothNumber, data]: [string, any]) => ({
    tooth_number: toothNumber,
    tooth_name: getToothName(toothNumber), // 歯の名称を取得
    status_label: data.status_label
  }));
}
```

---

#### 3. `get_tooth_detail_history(p_patient_id, p_tooth_number)`

**用途:** 特定の歯の治療履歴を取得（オプション・歯の詳細モーダル用）

**呼び出し方:**
```typescript
const { data, error } = await supabase.rpc('get_tooth_detail_history', {
  p_patient_id: userId,
  p_tooth_number: '16' // 歯番号
});
```

**返り値:** 配列
```typescript
[
  {
    recorded_at: string;
    status_label: string;
    staff_display_name: string;
    color: string;
  },
  // ...
]
```

---

### 3.3 認証について

**LIFFアプリでは、ユーザーIDをどこから取得するか？**

```typescript
import liff from '@line/liff';

// LIFF初期化
await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });

// ユーザーIDを取得
const profile = await liff.getProfile();
const userId = profile.userId; // "U1234567890abcdef"
```

このuserIdを使ってRPC関数を呼び出します。

**Supabase RLSについて:**

- `patient_dental_records` テーブルは anon key で **読み取り専用** に設定されています
- 誰でも全レコードを読めますが、アプリ層で `WHERE patient_id = userId` でフィルタする必要があります
- **すでにRPC関数内でフィルタ済み**なので、LIFF開発者は何もしなくて大丈夫です

---

## 4. 歯並び図（Odontogram）実装

### 4.1 歯の番号体系（ISO 3950）

**永久歯（32本）:**
```
    右上              左上
18 17 16 15 14 13 12 11 | 21 22 23 24 25 26 27 28
─────────────────────────┼─────────────────────────
48 47 46 45 44 43 42 41 | 31 32 33 34 35 36 37 38
    右下              左下
```

**乳歯（20本）:**
```
    右上              左上
   55 54 53 52 51    | 61 62 63 64 65
─────────────────────────┼─────────────────────────
   85 84 83 82 81    | 71 72 73 74 75
    右下              左下
```

### 4.2 SVGコンポーネント例

```typescript
import React from 'react';

type ToothData = {
  status: string;
  status_label: string;
  color: string;
  updated_at: string;
};

type DentalRecord = {
  tooth_data: { [toothNumber: string]: ToothData };
};

type ToothDiagramProps = {
  record: DentalRecord | null;
  onToothClick: (toothNumber: string) => void;
  isKidsMode?: boolean;
};

const PERMANENT_TEETH = [
  '18', '17', '16', '15', '14', '13', '12', '11',
  '21', '22', '23', '24', '25', '26', '27', '28',
  '48', '47', '46', '45', '44', '43', '42', '41',
  '31', '32', '33', '34', '35', '36', '37', '38',
];

const BABY_TEETH = [
  '55', '54', '53', '52', '51',
  '61', '62', '63', '64', '65',
  '85', '84', '83', '82', '81',
  '71', '72', '73', '74', '75',
];

export default function ToothDiagram({ record, onToothClick, isKidsMode = false }: ToothDiagramProps) {
  const teeth = isKidsMode ? BABY_TEETH : PERMANENT_TEETH;

  const getToothColor = (toothNumber: string): string => {
    const data = record?.tooth_data?.[toothNumber];
    if (!data) return '#e0e0e0'; // グレー（記録なし）
    return data.color; // データベースから取得した色
  };

  return (
    <svg viewBox="0 0 800 400" className="w-full h-auto">
      {teeth.map((toothNumber, index) => {
        // 簡易的な位置計算
        const teethPerRow = isKidsMode ? 5 : 8;
        const col = index % teethPerRow;
        const row = Math.floor(index / teethPerRow);
        const x = 50 + col * 80;
        const y = row < 2 ? 50 : 250;

        return (
          <g
            key={toothNumber}
            onClick={() => onToothClick(toothNumber)}
            className="cursor-pointer hover:opacity-80"
          >
            <rect
              x={x}
              y={y}
              width="60"
              height="80"
              rx="8"
              fill={getToothColor(toothNumber)}
              stroke="#4b5563"
              strokeWidth="1.5"
            />
            <text
              x={x + 30}
              y={y + 45}
              textAnchor="middle"
              fontSize="14"
              fill="#334155"
            >
              {toothNumber}
            </text>
          </g>
        );
      })}

      {/* 中央線 */}
      <line x1="400" y1="30" x2="400" y2="370" stroke="#ccc" strokeWidth="2" />
      {/* 上下区切り線 */}
      <line x1="30" y1="200" x2="770" y2="200" stroke="#ccc" strokeWidth="2" />
    </svg>
  );
}
```

**状態別の色:**

| status | color | 意味 |
|--------|-------|------|
| `cavity_completed` | `#10b981` (緑) | 虫歯治療済み |
| `observation` | `#fbbf24` (黄) | 経過観察 |
| `cavity_planned` | `#ef4444` (赤) | 治療予定 |
| `crown` | `#3b82f6` (青) | 被せ物 |
| `scaling_completed` | `#10b981` (緑) | 歯石除去済み |
| `cleaning` | `#8b5cf6` (紫) | クリーニング |
| (記録なし) | `#e0e0e0` (グレー) | 未記録 |

---

## 5. 治療履歴タイムライン

### 5.1 データ取得とフィルタリング

```typescript
import { supabase } from '@/lib/supabase/client';

async function fetchHistory(userId: string) {
  const { data, error } = await supabase.rpc('get_dental_record_history', {
    p_patient_id: userId,
    p_limit: 20
  });

  if (error) throw error;

  // tooth_data から変更箇所を抽出
  return data.map(record => ({
    ...record,
    changes: extractChanges(record.tooth_data)
  }));
}

function extractChanges(toothData: any) {
  return Object.entries(toothData || {}).map(([toothNumber, data]: [string, any]) => ({
    tooth_number: toothNumber,
    tooth_name: getToothName(toothNumber),
    status_label: data.status_label
  }));
}

function getToothName(toothNumber: string): string {
  // 歯の名称マッピング（簡略版）
  const names: { [key: string]: string } = {
    '16': '右上第一大臼歯',
    '32': '左下中切歯',
    // ... 他の歯を追加
  };
  return names[toothNumber] || `歯番号${toothNumber}`;
}
```

### 5.2 タイムラインコンポーネント

```typescript
type HistoryChange = {
  tooth_number: string;
  tooth_name: string;
  status_label: string;
};

type HistoryRecord = {
  id: string;
  recorded_at: string;
  staff_display_name: string;
  next_visit_memo: string | null;
  changes: HistoryChange[];
};

export default function TreatmentTimeline({ records }: { records: HistoryRecord[] }) {
  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-bold">治療履歴</h2>
      {records.length === 0 ? (
        <p className="text-gray-500">まだ治療記録がありません</p>
      ) : (
        records.map((record) => (
          <div key={record.id} className="border rounded-lg p-4 bg-white shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">📅</span>
              <span className="font-semibold">
                {new Date(record.recorded_at).toLocaleDateString('ja-JP')}
              </span>
            </div>

            <div className="text-sm text-gray-600 mb-2">
              担当: {record.staff_display_name}
            </div>

            <ul className="space-y-1 mb-2">
              {record.changes.map((change, idx) => (
                <li key={idx} className="text-sm">
                  ・{change.tooth_name}（{change.tooth_number}）{change.status_label}
                </li>
              ))}
            </ul>

            {record.next_visit_memo && (
              <div className="text-sm bg-blue-50 p-2 rounded border-l-4 border-blue-400">
                <span className="font-semibold">次回:</span> {record.next_visit_memo}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
```

---

## 6. ViewMode対応（adult/kids）

### 6.1 既存のViewModeContext を使用

既存プロジェクトでは `contexts/ViewModeContext.tsx` で大人用/子供用モードを管理しています。

```typescript
import { useViewMode } from '@/contexts/ViewModeContext';

export default function CarePage() {
  const { viewMode } = useViewMode();

  if (viewMode === 'kids') {
    return <KidsCarePage />;
  }

  return <AdultCarePage />;
}
```

**参考:** [02_ファイル構成.md - アーキテクチャ: 表示モード分岐](02_ファイル構成.md#アーキテクチャ-表示モード分岐)

### 6.2 歯並び図の切り替え

```typescript
// components/(adult)/AdultCarePage.tsx 内
<ToothDiagram
  record={latestRecord}
  onToothClick={handleToothClick}
  isKidsMode={false}  // 大人用は永久歯（32本）
/>

// components/(kids)/KidsCarePage.tsx 内
<ToothDiagram
  record={latestRecord}
  onToothClick={handleToothClick}
  isKidsMode={true}   // 子供用は乳歯（20本）
/>
```

---

## 7. コンポーネント設計（既存プロジェクト構造に準拠）

### 7.1 ファイル構成

```
app/
└── care/
    └── page.tsx                        # ViewMode分岐ページ（既存）

components/
├── (adult)/
│   └── AdultCarePage.tsx               # 大人用ケア記録（拡張対象）
├── (kids)/
│   └── KidsCarePage.tsx                # 子供用ケア記録（拡張対象）
└── dental/                             # 新規作成（ケア記録専用コンポーネント）
    ├── ToothDiagram.tsx                # 歯並び図SVG（共通）
    ├── TreatmentTimeline.tsx           # 治療履歴タイムライン（共通）
    ├── Legend.tsx                      # 凡例（共通）
    └── ToothDetailModal.tsx            # 歯の詳細モーダル（オプション）

lib/
└── dental-records.ts                   # 新規作成（ユーティリティ関数・SWRフック）

types/
└── dental-record.ts                    # 新規作成（ケア記録型定義）
```

**参考:** [02_ファイル構成.md - components/(adult)/](02_ファイル構成.md#L96-L103)

### 7.2 メインページ実装例

#### app/care/page.tsx（ViewMode分岐）

```typescript
'use client';

import { useViewMode } from '@/contexts/ViewModeContext';
import AdultCarePage from '@/components/(adult)/AdultCarePage';
import KidsCarePage from '@/components/(kids)/KidsCarePage';

export default function CarePage() {
  const { viewMode } = useViewMode();

  if (viewMode === 'kids') {
    return <KidsCarePage />;
  }

  return <AdultCarePage />;
}
```

#### components/(adult)/AdultCarePage.tsx（拡張例）

```typescript
'use client';

import { useLiff } from '@/hooks/useLiff';
import { useLatestRecord, useHistoryRecords } from '@/lib/dental-records';
import ToothDiagram from '@/components/dental/ToothDiagram';
import TreatmentTimeline from '@/components/dental/TreatmentTimeline';
import Legend from '@/components/dental/Legend';

export default function AdultCarePage() {
  const { profile, isLoading, error } = useLiff();

  const { data: latestRecord } = useLatestRecord(profile?.userId);
  const { data: history } = useHistoryRecords(profile?.userId);

  if (isLoading) {
    return <div className="p-4">読み込み中...</div>;
  }

  if (error || !profile) {
    return <div className="p-4 text-red-500">エラーが発生しました</div>;
  }

  const handleToothClick = (toothNumber: string) => {
    console.log('Tooth clicked:', toothNumber);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm p-4">
        <h1 className="text-xl font-bold text-center">マイデンタルマップ</h1>
      </header>

      <section className="p-4 bg-white">
        <ToothDiagram
          record={latestRecord}
          onToothClick={handleToothClick}
          isKidsMode={false}
        />
      </section>

      <Legend />

      {latestRecord?.next_visit_memo && (
        <section className="mx-4 p-3 bg-blue-50 rounded border-l-4 border-blue-400">
          <p className="text-sm font-semibold">次回予定:</p>
          <p className="text-sm">{latestRecord.next_visit_memo}</p>
        </section>
      )}

      <TreatmentTimeline records={history || []} />
    </div>
  );
}
```

#### lib/dental-records.ts（SWRフック・ユーティリティ）

```typescript
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';

export function useLatestRecord(userId: string | undefined) {
  return useSWR(
    userId ? ['latest-record', userId] : null,
    async () => {
      const { data } = await supabase.rpc('get_latest_dental_record', {
        p_patient_id: userId!
      });
      return data;
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );
}

export function useHistoryRecords(userId: string | undefined) {
  return useSWR(
    userId ? ['history-records', userId] : null,
    async () => {
      const { data } = await supabase.rpc('get_dental_record_history', {
        p_patient_id: userId!,
        p_limit: 20
      });

      return data?.map(record => ({
        ...record,
        changes: extractChanges(record.tooth_data)
      })) || [];
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );
}

function extractChanges(toothData: any) {
  return Object.entries(toothData || {}).map(([toothNumber, data]: [string, any]) => ({
    tooth_number: toothNumber,
    tooth_name: getToothName(toothNumber),
    status_label: data.status_label
  }));
}

function getToothName(toothNumber: string): string {
  // TODO: 完全な歯の名称マッピングを実装
  return `歯${toothNumber}`;
}
```

---

## 8. 状態管理

### 8.1 SWRを使ったキャッシング（推奨）

```typescript
import useSWR from 'swr';
import { supabase } from '@/lib/supabase/client';

function useLatestRecord(userId: string | null) {
  return useSWR(
    userId ? ['latest-record', userId] : null,
    async () => {
      const { data } = await supabase.rpc('get_latest_dental_record', {
        p_patient_id: userId!
      });
      return data;
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000 // 1分間キャッシュ
    }
  );
}

// 使用例
const { data: latestRecord, error } = useLatestRecord(userId);
```

---

## 9. エラーハンドリング

### 9.1 記録がない場合

```typescript
if (!latestRecord) {
  return (
    <div className="p-4 text-center">
      <p className="text-gray-500">まだ治療記録がありません</p>
      <p className="text-sm text-gray-400">次回の診療後に記録が表示されます</p>
    </div>
  );
}
```

### 9.2 Supabaseエラー

```typescript
const { data, error } = await supabase.rpc('get_latest_dental_record', {
  p_patient_id: userId
});

if (error) {
  console.error('Supabase error:', error);
  // エラー表示
}
```

---

## 10. パフォーマンス最適化

### 10.1 SVGの最適化

```typescript
const ToothDiagram = React.memo(({ record, onToothClick }) => {
  // ...
}, (prevProps, nextProps) => {
  return prevProps.record?.tooth_data === nextProps.record?.tooth_data;
});
```

### 10.2 SWRキャッシュ設定

```typescript
const swrConfig = {
  dedupingInterval: 60000,        // 1分間は同じリクエストを重複させない
  revalidateOnFocus: false,       // フォーカス時の再検証を無効化
  revalidateOnReconnect: true,    // ネットワーク復帰時は再検証
};
```

---

## 11. 開発手順

### Phase 1: 基本実装（1週間）
- [ ] LIFF初期化とユーザーID取得
- [ ] Supabase RPC `get_latest_dental_record` を呼び出し
- [ ] 基本的な歯並び図（矩形ベース）表示
- [ ] 色分けロジック実装

### Phase 2: タイムライン（1週間）
- [ ] `get_dental_record_history` を呼び出し
- [ ] `tooth_data` から変更箇所を抽出
- [ ] タイムラインコンポーネント実装

### Phase 3: UI改善（1週間）
- [ ] こどもモード実装
- [ ] レスポンシブ対応
- [ ] アニメーション追加

### Phase 4: テスト（3日）
- [ ] エラーハンドリング強化
- [ ] 実機テスト（LIFF環境）

---

## 12. 参考資料

### 12.1 既存実装

- [supabase/019_create_dental_records_table.sql](../supabase/019_create_dental_records_table.sql) - RPC関数定義
- [41_ケア記録機能.md](41_ケア記録機能.md) - 全体仕様

### 12.2 Supabase RPC関数

すでに実装済みの3つのRPC関数:
1. `get_latest_dental_record(p_patient_id TEXT)`
2. `get_dental_record_history(p_patient_id TEXT, p_limit INTEGER, p_offset INTEGER)`
3. `get_tooth_detail_history(p_patient_id TEXT, p_tooth_number TEXT)`

---

## 13. FAQ

**Q1: Next.js APIエンドポイントを作る必要はありますか？**
→ いいえ。Supabase RPC関数を直接呼び出してください。

**Q2: 認証トークンは必要ですか？**
→ LIFF初期化で得られるuserIdを使うだけでOKです。Supabase anon keyで接続します。

**Q3: 治療記録がない患者はどう表示する？**
→ RPC関数がnullを返すので、全ての歯をグレーで表示します。

**Q4: スタッフメモは表示しますか？**
→ いいえ。RPC関数は`next_visit_memo`のみ返します。`staff_memo`は含まれません。

**Q5: 歯の詳細モーダルは必須ですか？**
→ Phase 1では省略可。タイムラインで十分です。

---

**最終更新:** 2026-03-07
**作成者:** Claude (AI Assistant)
**レビュー:** 未実施
