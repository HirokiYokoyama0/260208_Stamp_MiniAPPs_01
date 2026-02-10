# 子供用モード実装 仕様書

## 📋 概要

大人用デザインに加えて、子供向けのカラフルで楽しいデザインモードを追加します。ユーザーは医院情報ページの設定から自由に切り替えられます。

---

## 🎯 実装方式

### 方式：ユーザー設定として保存（方式A）

**特徴：**
- ユーザーごとに「大人モード/子供モード」を選択・保存
- Supabaseのprofilesテーブルで管理
- デバイスを変えても設定が引き継がれる

**切り替えUI：医院情報タブに設定メニュー（案2）**
- 医院情報ページに「設定」リンクを追加
- 設定ページで表示モードを切り替え
- 常に見える位置ではなく、設定として管理

---

## 🎨 デザインの違い

| 要素 | 大人用（現在） | 子供用（新規） |
|-----|-------------|--------------|
| **カラー** | スカイブルー・シャンパンゴールド | 明るいピンク・イエロー・グリーン |
| **フォント** | スッキリとしたサンセリフ | 丸ゴシック系（親しみやすい） |
| **ハブラーシカ** | 落ち着いた表情 | より表情豊か・アニメーション |
| **メッセージトーン** | 「次回の定期検診まで」 | 「はみがき がんばったね！」 |
| **スタンプデザイン** | シンプルなカード型 | キャラクター・イラスト付き |
| **特典名称** | 「フッ素塗布無料券」 | 「ピカピカはみがきごほうび」 |
| **ボタン** | 落ち着いた色 | カラフル・大きめ |
| **アニメーション** | 控えめ | 紙吹雪・バウンドエフェクト |

---

## 📁 フォルダ構成

### なぜフォルダを分けるのか？

| 理由 | 説明 |
|-----|------|
| **🔧 並行開発が可能** | 大人用と子供用を別々の人が同時に開発できる |
| **🎨 デザインの独立性** | 子供用のデザイナーが自由に実装できる |
| **🔒 コンフリクト防止** | Gitでのマージコンフリクトが起きにくい |
| **📦 保守性向上** | どちらかだけを修正しても影響が少ない |
| **🧪 テストが独立** | 大人用・子供用を別々にテスト可能 |

### 全体フォルダ構成

```
260208_Stamp_MiniAPPs_01/
├── app/
│   ├── page.tsx              # ルートページ（振り分け）
│   ├── stamp/page.tsx        # スタンプページ（振り分け）
│   ├── rewards/page.tsx      # 特典ページ（振り分け）
│   ├── care/page.tsx         # ケア記録ページ（振り分け）
│   ├── info/page.tsx         # 医院情報ページ（共通・設定リンク追加）
│   ├── settings/             # 設定ページ（新規作成）★
│   │   └── page.tsx          # 表示モード切り替え画面
│   ├── api/                  # API（共通）
│   │   ├── stamps/
│   │   └── rewards/
│   └── layout.tsx            # ルートレイアウト（共通）
│
├── components/
│   ├── (adult)/              # 大人用コンポーネント（既存を移動）
│   │   ├── AdultHome.tsx
│   │   ├── AdultStampPage.tsx
│   │   ├── AdultRewardsPage.tsx
│   │   ├── AdultCarePage.tsx
│   │   └── AdultInfoPage.tsx
│   │
│   ├── (kids)/               # 子供用コンポーネント（新規作成）★別の人が実装
│   │   ├── KidsHome.tsx
│   │   ├── KidsStampPage.tsx
│   │   ├── KidsRewardsPage.tsx
│   │   ├── KidsCarePage.tsx
│   │   └── KidsInfoPage.tsx
│   │
│   ├── shared/               # 共通コンポーネント
│   │   ├── QRScanner.tsx     # QRスキャナー（共通）
│   │   └── StaffPinModal.tsx # スタッフ操作モーダル（共通）
│   │
│   ├── features/             # 既存の機能コンポーネント
│   │   └── FriendshipPromptModal.tsx
│   │
│   └── layout/
│       ├── AppLayout.tsx     # レイアウト（共通）
│       └── VersionInfo.tsx   # バージョン情報（共通）
│
├── contexts/
│   └── ViewModeContext.tsx   # 表示モード管理（新規作成）★
│
├── hooks/
│   ├── useLiff.ts            # 既存
│   └── useViewMode.ts        # 表示モード取得フック（新規作成）★
│
├── lib/
│   ├── supabase.ts           # 既存
│   ├── stamps.ts             # 既存
│   └── rewards.ts            # 既存
│
├── types/
│   ├── stamp.ts              # 既存
│   ├── reward.ts             # 既存
│   └── viewMode.ts           # 表示モード型定義（新規作成）★
│
└── styles/
    ├── adult.css             # 大人用スタイル（必要に応じて）
    └── kids.css              # 子供用スタイル（新規作成）★別の人が実装
```

**★マーク = 新規作成が必要なファイル**

---

## 🗄️ データベース設計

### profilesテーブルの拡張

#### 追加するカラム

```sql
ALTER TABLE profiles
ADD COLUMN view_mode TEXT DEFAULT 'adult' CHECK (view_mode IN ('adult', 'kids'));

COMMENT ON COLUMN profiles.view_mode IS '表示モード: adult（大人用）/ kids（子供用）';
```

#### カラム定義

| カラム名 | 型 | デフォルト値 | 制約 | 説明 |
|---------|---|------------|------|------|
| view_mode | TEXT | 'adult' | CHECK (view_mode IN ('adult', 'kids')) | 表示モード |

#### 既存データへの影響

- ✅ デフォルト値が`'adult'`なので、既存ユーザーは大人用のまま
- ✅ 新規ユーザーも最初は大人用
- ✅ マイグレーション不要（カラム追加のみ）

---

## 🔑 共通インターフェース設計

### 1. 型定義（types/viewMode.ts）

```typescript
/**
 * 表示モードの型定義
 */
export type ViewMode = 'adult' | 'kids';

/**
 * ページコンポーネントの共通Props
 * 大人用・子供用で同じPropsを受け取るように統一
 */
export interface PageProps {
  viewMode: ViewMode;
  userId: string;
  userName: string;
}

/**
 * スタンプカードの共通Props
 */
export interface StampCardProps {
  stampCount: number;
  stampGoal: number;
  viewMode: ViewMode;
}
```

---

### 2. ViewModeContext（状態管理）

#### contexts/ViewModeContext.tsx

```typescript
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useLiff } from '@/hooks/useLiff';

type ViewMode = 'adult' | 'kids';

interface ViewModeContextValue {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => Promise<void>;
  isLoading: boolean;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>('adult');
  const [isLoading, setIsLoading] = useState(true);
  const { profile } = useLiff();

  // ログイン時にDBからview_modeを取得
  useEffect(() => {
    const fetchViewMode = async () => {
      if (!profile?.userId) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('view_mode')
          .eq('id', profile.userId)
          .single();

        if (!error && data?.view_mode) {
          setViewModeState(data.view_mode as ViewMode);
        }
      } catch (err) {
        console.error('❌ view_mode取得エラー:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchViewMode();
  }, [profile?.userId]);

  // view_modeをDBに保存
  const setViewMode = async (mode: ViewMode) => {
    if (!profile?.userId) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ view_mode: mode, updated_at: new Date().toISOString() })
        .eq('id', profile.userId);

      if (error) throw error;

      setViewModeState(mode);
      console.log(`✅ view_modeを ${mode} に変更しました`);
    } catch (err) {
      console.error('❌ view_mode保存エラー:', err);
    }
  };

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode, isLoading }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export const useViewMode = () => {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error('useViewMode must be used within ViewModeProvider');
  }
  return context;
};
```

---

### 3. カスタムフック（hooks/useViewMode.ts）

```typescript
import { useContext } from 'react';
import { ViewModeContext } from '@/contexts/ViewModeContext';

/**
 * 表示モードを取得するカスタムフック
 * ViewModeContextのラッパー
 */
export const useViewMode = () => {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error('useViewMode must be used within ViewModeProvider');
  }
  return context;
};
```

---

## 🎨 Tailwind CSS設定

### tailwind.config.ts

```typescript
export default {
  theme: {
    extend: {
      colors: {
        // 大人用（既存）
        primary: '#7DD3FC',
        'primary-dark': '#0EA5E9',

        // 子供用（新規追加）
        'kids-pink': '#FF6B9D',
        'kids-yellow': '#FFD93D',
        'kids-green': '#6BCF7F',
        'kids-blue': '#4ECDC4',
        'kids-purple': '#A78BFA',
      },
      fontFamily: {
        // 子供用フォント（丸ゴシック）
        'kids': ['"M PLUS Rounded 1c"', 'ui-rounded', 'sans-serif'],
      },
    }
  }
}
```

### 子供用カラーパレット

| カラー名 | 色コード | 用途 |
|---------|---------|------|
| kids-pink | #FF6B9D | メインカラー、アクセント |
| kids-yellow | #FFD93D | 背景、ハイライト |
| kids-green | #6BCF7F | 成功メッセージ、達成時 |
| kids-blue | #4ECDC4 | ボタン、リンク |
| kids-purple | #A78BFA | 特典、ごほうび |

---

## 📱 画面設計

### 1. 設定ページ（app/settings/page.tsx）

#### UI構成

```
┌─────────────────────────────────────┐
│  設定                                │
├─────────────────────────────────────┤
│  表示モード                          │
│                                      │
│  ┌───────────────────────────────┐   │
│  │ 👨‍🦱 大人用                     │   │
│  │ 落ち着いたデザイン             │   │
│  │                    [選択中]    │   │
│  └───────────────────────────────┘   │
│                                      │
│  ┌───────────────────────────────┐   │
│  │ 👶 子供用                       │   │
│  │ 楽しくカラフルなデザイン       │   │
│  │                                │   │
│  └───────────────────────────────┘   │
│                                      │
│  ┌───────────────────────────────┐   │
│  │ ℹ️ 表示モードはいつでも変更    │   │
│  │   できます。                   │   │
│  │   スタンプや特典のデータは     │   │
│  │   共通です。                   │   │
│  └───────────────────────────────┘   │
└─────────────────────────────────────┘
```

#### 実装例

```typescript
'use client';

import { useViewMode } from '@/contexts/ViewModeContext';
import { Baby, User } from 'lucide-react';

export default function SettingsPage() {
  const { viewMode, setViewMode, isLoading } = useViewMode();

  const handleModeChange = async (mode: 'adult' | 'kids') => {
    await setViewMode(mode);
    alert(`${mode === 'adult' ? '大人用' : '子供用'}モードに切り替えました！`);
  };

  return (
    <div className="px-4 py-6">
      <h2 className="mb-6 text-lg font-semibold text-gray-800">設定</h2>

      {/* 表示モード選択 */}
      <section className="mb-6">
        <h3 className="mb-3 text-sm font-medium text-gray-700">表示モード</h3>
        <div className="space-y-3">
          {/* 大人用 */}
          <button
            onClick={() => handleModeChange('adult')}
            disabled={isLoading}
            className={`flex w-full items-center gap-4 rounded-lg border-2 p-4 transition-all ${
              viewMode === 'adult'
                ? 'border-primary bg-primary/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <User size={32} className={viewMode === 'adult' ? 'text-primary' : 'text-gray-400'} />
            <div className="flex-1 text-left">
              <p className="font-semibold text-gray-800">大人用</p>
              <p className="text-xs text-gray-500">落ち着いたデザイン</p>
            </div>
            {viewMode === 'adult' && (
              <span className="text-xs font-medium text-primary">選択中</span>
            )}
          </button>

          {/* 子供用 */}
          <button
            onClick={() => handleModeChange('kids')}
            disabled={isLoading}
            className={`flex w-full items-center gap-4 rounded-lg border-2 p-4 transition-all ${
              viewMode === 'kids'
                ? 'border-kids-pink bg-kids-pink/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Baby size={32} className={viewMode === 'kids' ? 'text-kids-pink' : 'text-gray-400'} />
            <div className="flex-1 text-left">
              <p className="font-semibold text-gray-800">子供用</p>
              <p className="text-xs text-gray-500">楽しくカラフルなデザイン</p>
            </div>
            {viewMode === 'kids' && (
              <span className="text-xs font-medium text-kids-pink">選択中</span>
            )}
          </button>
        </div>
      </section>

      {/* 説明 */}
      <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
        <p>表示モードはいつでも変更できます。</p>
        <p className="mt-2">スタンプや特典のデータは共通です。</p>
      </div>
    </div>
  );
}
```

---

### 2. 医院情報ページに設定リンク追加

#### app/info/page.tsx（変更箇所）

```typescript
import Link from 'next/link';
import { Settings } from 'lucide-react';

export default function InfoPage() {
  // ... 既存のコード

  return (
    <div className="px-4 py-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-800">医院情報</h2>

      {/* 設定リンク（新規追加）*/}
      <section className="mb-6">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50"
        >
          <Settings className="text-primary" size={20} />
          <div className="flex-1">
            <p className="font-semibold text-gray-800">設定</p>
            <p className="text-xs text-gray-500">表示モードの切り替えなど</p>
          </div>
          <span className="text-gray-400">›</span>
        </Link>
      </section>

      {/* ... 既存のコンテンツ（公式LINE、基本情報、アクセス、休診日） */}
    </div>
  );
}
```

---

### 3. ページの振り分け実装

#### app/page.tsx（診察券ページ）

```typescript
'use client';

import { useViewMode } from '@/contexts/ViewModeContext';
import AdultHome from '@/components/(adult)/AdultHome';
import KidsHome from '@/components/(kids)/KidsHome';

export default function HomePage() {
  const { viewMode, isLoading } = useViewMode();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 表示モードに応じてコンポーネントを切り替え
  return viewMode === 'kids' ? <KidsHome /> : <AdultHome />;
}
```

#### app/stamp/page.tsx（スタンプページ）

```typescript
'use client';

import { useViewMode } from '@/contexts/ViewModeContext';
import AdultStampPage from '@/components/(adult)/AdultStampPage';
import KidsStampPage from '@/components/(kids)/KidsStampPage';

export default function StampPage() {
  const { viewMode, isLoading } = useViewMode();

  if (isLoading) {
    return <div className="p-6 text-center text-gray-500">読み込み中...</div>;
  }

  return viewMode === 'kids' ? <KidsStampPage /> : <AdultStampPage />;
}
```

#### app/rewards/page.tsx（特典ページ）

```typescript
'use client';

import { useViewMode } from '@/contexts/ViewModeContext';
import AdultRewardsPage from '@/components/(adult)/AdultRewardsPage';
import KidsRewardsPage from '@/components/(kids)/KidsRewardsPage';

export default function RewardsPage() {
  const { viewMode, isLoading } = useViewMode();

  if (isLoading) {
    return <div className="p-6 text-center text-gray-500">読み込み中...</div>;
  }

  return viewMode === 'kids' ? <KidsRewardsPage /> : <AdultRewardsPage />;
}
```

---

## 👶 子供用コンポーネント実装ガイド

### 対象者：別の開発者・デザイナー

このセクションは、子供用画面を実装する担当者向けのガイドです。

---

### 📦 実装が必要なコンポーネント一覧

#### 1. KidsHome.tsx（診察券ページ）

**ファイルパス：** `components/(kids)/KidsHome.tsx`

**デザイン要件：**
- カラフルな背景（ピンク・イエロー・グリーン）
- ハブラーシカのイラストを大きく表示
- 丸ゴシックフォント（font-kids）
- 大きめのボタン（タップしやすく）
- 子供向けメッセージ（例：「はみがき がんばったね！」）

**Props：**
- なし（内部でuseLiff、useViewModeを使う）

**データ取得方法：**
```typescript
import { useLiff } from '@/hooks/useLiff';
import { fetchStampCount } from '@/lib/stamps';
```

---

#### 2. KidsStampPage.tsx（スタンプページ）

**ファイルパス：** `components/(kids)/KidsStampPage.tsx`

**デザイン要件：**
- スタンプがキャラクター風のイラスト
- アニメーション付き（バウンド、回転など）
- 達成時に紙吹雪エフェクト
- 大きな数字表示（視認性重視）
- 励ましメッセージ（「あと3こで ごほうびだよ！」）

**Props：**
- なし

**データ取得方法：**
```typescript
import { fetchStampCount, fetchStampHistory } from '@/lib/stamps';
```

---

#### 3. KidsRewardsPage.tsx（特典ページ）

**ファイルパス：** `components/(kids)/KidsRewardsPage.tsx`

**デザイン要件：**
- 特典にキャラクターイラスト付き
- 子供向けの名称（例：「ピカピカはみがきごほうび」）
- カラフルなカード型デザイン
- 交換ボタンが大きくてわかりやすい
- 達成時に「すごい！」などの称賛メッセージ

**Props：**
- なし

**データ取得方法：**
```typescript
import { fetchRewards, exchangeReward } from '@/lib/rewards';
```

---

#### 4. KidsCarePage.tsx（ケア記録ページ）

**ファイルパス：** `components/(kids)/KidsCarePage.tsx`

**デザイン要件：**
- 大きなチェックボックス
- イラスト付きのケア項目
- できたら「✨」などのエフェクト
- 継続日数を褒める仕組み

**Props：**
- なし

---

#### 5. KidsInfoPage.tsx（医院情報ページ）

**ファイルパス：** `components/(kids)/KidsInfoPage.tsx`

**デザイン要件：**
- イラスト入りの地図
- わかりやすい診療時間表示
- 親しみやすいトーン

**Props：**
- なし

---

### 🎨 使用可能なTailwind CSSクラス

#### カラー

```tsx
// 背景色
className="bg-kids-pink"
className="bg-kids-yellow/10"  // 薄い黄色

// 文字色
className="text-kids-green"
className="text-kids-purple"

// ボーダー
className="border-kids-blue"
```

#### フォント

```tsx
// 子供用フォント（丸ゴシック）
className="font-kids"
```

#### アニメーション

```tsx
// バウンド
className="animate-bounce"

// 回転
className="animate-spin"

// パルス
className="animate-pulse"
```

---

### 📡 データ取得方法（共通API使用）

#### スタンプ関連

```typescript
import { fetchStampCount, fetchStampHistory, addStamp } from '@/lib/stamps';

// スタンプ数を取得
const stampCount = await fetchStampCount(userId);

// 来院履歴を取得
const history = await fetchStampHistory(userId);

// スタンプを追加
const result = await addStamp(userId, qrCodeId);
```

#### 特典関連

```typescript
import { fetchRewards, exchangeReward } from '@/lib/rewards';

// 特典一覧を取得
const rewards = await fetchRewards();

// 特典を交換
const result = await exchangeReward(userId, rewardId);
```

---

### ✅ 実装完了チェックリスト

- [ ] KidsHome.tsx 実装完了
- [ ] KidsStampPage.tsx 実装完了
- [ ] KidsRewardsPage.tsx 実装完了
- [ ] KidsCarePage.tsx 実装完了
- [ ] KidsInfoPage.tsx 実装完了
- [ ] styles/kids.css 作成（必要に応じて）
- [ ] モバイルで表示確認
- [ ] 大人用から切り替え動作確認
- [ ] スタンプ・特典データが共通であることを確認
- [ ] デザインレビュー

---

## 🚀 実装手順（フェーズ別）

### Phase 1：基盤整備（メイン開発者が実装）

#### タスク一覧

1. **データベース拡張**
   - [ ] profilesテーブルにview_modeカラム追加
   - [ ] Supabase SQL Editorで実行
   - [ ] 動作確認

2. **型定義作成**
   - [ ] types/viewMode.ts 作成
   - [ ] ViewMode、PageProps、StampCardProps定義

3. **ViewModeContext実装**
   - [ ] contexts/ViewModeContext.tsx 作成
   - [ ] ViewModeProvider実装
   - [ ] useViewMode hook実装

4. **app/layout.tsx修正**
   - [ ] ViewModeProviderでラップ

5. **設定ページ実装**
   - [ ] app/settings/page.tsx 作成
   - [ ] 切り替えUI実装
   - [ ] Supabase連携

6. **医院情報ページ修正**
   - [ ] app/info/page.tsx に設定リンク追加

7. **既存ページの振り分け実装**
   - [ ] app/page.tsx 修正（診察券）
   - [ ] app/stamp/page.tsx 修正
   - [ ] app/rewards/page.tsx 修正
   - [ ] app/care/page.tsx 修正

8. **既存コンポーネントの移動**
   - [ ] 既存のページコンテンツをcomponents/(adult)/に移動
   - [ ] AdultHome.tsx 作成
   - [ ] AdultStampPage.tsx 作成
   - [ ] AdultRewardsPage.tsx 作成
   - [ ] AdultCarePage.tsx 作成

9. **Tailwind CSS設定**
   - [ ] tailwind.config.ts に子供用カラー追加
   - [ ] font-kids設定追加

10. **ドキュメント作成**
    - [ ] 実装ガイド作成（本ドキュメント）
    - [ ] TODO.md 更新

**完了目安：** 2～3日

---

### Phase 2：子供用実装（別の開発者が実装）

#### タスク一覧

1. **子供用コンポーネント作成**
   - [ ] components/(kids)/KidsHome.tsx
   - [ ] components/(kids)/KidsStampPage.tsx
   - [ ] components/(kids)/KidsRewardsPage.tsx
   - [ ] components/(kids)/KidsCarePage.tsx
   - [ ] components/(kids)/KidsInfoPage.tsx

2. **スタイル作成**
   - [ ] styles/kids.css（必要に応じて）

3. **動作確認**
   - [ ] 各ページの表示確認
   - [ ] データ取得の確認
   - [ ] 大人用から切り替え確認

**完了目安：** 1週間～10日（デザインの複雑さによる）

---

### Phase 3：統合テスト（両者で確認）

#### タスク一覧

1. **機能テスト**
   - [ ] 切り替え動作確認
   - [ ] データ共通性確認（スタンプ、特典）
   - [ ] QRスキャン動作確認
   - [ ] 特典交換動作確認

2. **表示確認**
   - [ ] iPhone（Safari）で表示確認
   - [ ] Android（Chrome）で表示確認
   - [ ] 各画面のレスポンシブ確認

3. **パフォーマンス確認**
   - [ ] 切り替え速度確認
   - [ ] 画像読み込み速度確認

4. **バグ修正**
   - [ ] 発見された問題の修正

**完了目安：** 2～3日

---

### Phase 4：本番デプロイ

1. **Supabase本番環境**
   - [ ] view_modeカラム追加

2. **Vercelデプロイ**
   - [ ] ビルド確認
   - [ ] 環境変数確認
   - [ ] デプロイ実行

3. **動作確認**
   - [ ] 本番環境で全機能テスト

**完了目安：** 1日

---

## ⚠️ 重要な注意点

### 1. データは完全に共通

- ✅ スタンプ数は大人用・子供用で共通
- ✅ 特典交換履歴も共通
- ✅ 来院履歴も共通
- ✅ 切り替えてもデータは引き継がれる

**理由：**
- 同じユーザーが見た目だけ変えているため
- DBのprofilesテーブルは同じレコードを参照

---

### 2. APIは変更不要

- ✅ `POST /api/stamps` はそのまま使用
- ✅ `POST /api/rewards/exchange` もそのまま使用
- ✅ バックエンドロジックは変更なし

**理由：**
- 表示が変わるだけで、データ処理は同じ

---

### 3. 既存の大人用画面は動作不変

- ✅ components/(adult)/に移動するだけ
- ✅ 動作は変わらない
- ✅ 既存ユーザーに影響なし

**理由：**
- デフォルト値が`'adult'`なので、既存ユーザーは大人用のまま

---

### 4. 家族での利用ケース

**想定ケース：**
- 親が大人用モードで使用
- 子供に見せる時だけ子供用モードに切り替え
- 1つのLINEアカウントで切り替える

**対応：**
- 設定ページで簡単に切り替え可能
- データは共通なので混乱しない

---

## 🎯 子供用デザインの推奨事項

### 1. 色使い

- ✅ 明るく楽しい色（ピンク・イエロー・グリーン）
- ✅ コントラストを強く（視認性重視）
- ❌ 暗い色、落ち着きすぎた色は避ける

### 2. フォント

- ✅ 丸ゴシック系
- ✅ 大きめのサイズ
- ❌ 細すぎるフォントは避ける

### 3. アニメーション

- ✅ 紙吹雪、バウンド、回転
- ✅ 達成感を演出
- ❌ 過度なアニメーションは避ける（酔う可能性）

### 4. メッセージトーン

- ✅ 「がんばったね！」「すごい！」
- ✅ ひらがな多め（漢字にはルビ）
- ❌ 難しい言葉は避ける

### 5. イラスト

- ✅ ハブラーシカのイラスト大きく
- ✅ キャラクター風のスタンプ
- ✅ 特典にもイラスト付き

---

## 📊 進捗管理

### タスク管理表

| フェーズ | タスク | 担当 | 状態 | 完了日 |
|---------|-------|------|------|--------|
| Phase 1 | データベース拡張 | メイン開発者 | ⏳ 未着手 | - |
| Phase 1 | ViewModeContext実装 | メイン開発者 | ⏳ 未着手 | - |
| Phase 1 | 設定ページ実装 | メイン開発者 | ⏳ 未着手 | - |
| Phase 1 | 既存コンポーネント移動 | メイン開発者 | ⏳ 未着手 | - |
| Phase 2 | 子供用コンポーネント実装 | 別の開発者 | ⏳ 未着手 | - |
| Phase 3 | 統合テスト | 両者 | ⏳ 未着手 | - |
| Phase 4 | 本番デプロイ | メイン開発者 | ⏳ 未着手 | - |

---

## 📝 Gitコミットメッセージ例

### Phase 1

```
feat: 子供用モード基盤実装（Phase 1）

- profilesテーブルにview_modeカラム追加
- ViewModeContext実装
- 設定ページ実装（app/settings/page.tsx）
- 医院情報ページに設定リンク追加
- 既存コンポーネントをcomponents/(adult)/に移動
- Tailwind CSSに子供用カラー追加
- 型定義（types/viewMode.ts）作成
```

### Phase 2（別の開発者）

```
feat: 子供用モードUI実装（Phase 2）

- KidsHome.tsx 実装
- KidsStampPage.tsx 実装
- KidsRewardsPage.tsx 実装
- KidsCarePage.tsx 実装
- KidsInfoPage.tsx 実装
- 子供用スタイル（styles/kids.css）作成
```

### Phase 3

```
test: 子供用モード統合テスト完了（Phase 3）

- 切り替え動作確認完了
- データ共通性確認完了
- モバイル表示確認完了
- バグ修正（〇〇の不具合対応）
```

---

## 🔗 関連ドキュメント

- [プロジェクト仕様書](つくばホワイト歯科_ハブラーシカ_LINEミニアプリ仕様書_大人版.md)
- [TODO.md](TODO.md)
- [ファイル構成.md](ファイル構成.md)
- [Implementation_Summary_20260209.md](Implementation_Summary_20260209.md)
- [Supabase_Setup.md](Supabase_Setup.md)

---

## 改訂履歴

| 日付 | バージョン | 内容 |
|------|----------|------|
| 2026-02-11 | 1.0 | 初版作成：子供用モード実装仕様書 |

---

**作成日:** 2026年2月11日
**対象:** つくばホワイト歯科 × ハブラーシカ LINEミニアプリ
**実装方式:** 方式A（ユーザー設定） + 案2（医院情報タブに設定メニュー）