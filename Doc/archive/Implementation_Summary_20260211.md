# 実装サマリー - 2026年2月11日

## 本日の実装内容

### 子供用モード基盤（Kids Mode Phase 1）
### 子供用ページUI実装開始

---

## 1. フォルダ構成リファクタリング

### 1-1. コンポーネント分離

既存のページコンポーネントを大人用/子供用に分離。

**移動・新規作成したファイル:**

| ファイル | 内容 |
|---------|------|
| `components/(adult)/AdultHome.tsx` | 旧 `app/page.tsx` のUI部分を抽出 |
| `components/(adult)/AdultStampPage.tsx` | 旧 `app/stamp/page.tsx` のUI部分を抽出 |
| `components/(adult)/AdultRewardsPage.tsx` | 旧 `app/rewards/page.tsx` のUI部分を抽出 |
| `components/(adult)/AdultCarePage.tsx` | 旧 `app/care/page.tsx` のUI部分を抽出 |
| `components/(adult)/AdultInfoPage.tsx` | 旧 `app/info/page.tsx` のUI部分を抽出 + 設定リンク追加 |
| `components/(kids)/KidsHome.tsx` | 子供用ホーム（プレースホルダー） |
| `components/(kids)/KidsStampPage.tsx` | 子供用スタンプ（ハブラーシカ画像付き） |
| `components/(kids)/KidsRewardsPage.tsx` | 子供用特典（プレースホルダー） |
| `components/(kids)/KidsCarePage.tsx` | 子供用ケア記録（プレースホルダー） |
| `components/(kids)/KidsInfoPage.tsx` | 子供用医院情報（ひらがな表記、設定リンク付き） |

### 1-2. 共有コンポーネント移動

| 移動元 | 移動先 |
|--------|--------|
| `components/features/QRScanner.tsx` | `components/shared/QRScanner.tsx` |
| `components/features/StaffPinModal.tsx` | `components/shared/StaffPinModal.tsx` |

旧ファイル（features/QRScanner.tsx、features/StaffPinModal.tsx）は削除済み。

---

## 2. ViewModeContext（表示モード管理）

**ファイル:** `contexts/ViewModeContext.tsx`

- `ViewModeProvider`: アプリ全体をラップするContext Provider
- `useViewMode()`: viewMode（'adult' | 'kids'）を取得するフック
- Supabase `profiles.view_mode` と同期
- デフォルト値: `'adult'`
- エラー時もデフォルトで動作（クラッシュしない）

**型定義:** `types/viewMode.ts`

```typescript
export type ViewMode = 'adult' | 'kids';
```

---

## 3. ページルーティング変更

全5ページを同一パターンに書き換え:

```typescript
// app/page.tsx, stamp/page.tsx, rewards/page.tsx, care/page.tsx, info/page.tsx
const { viewMode, isLoading } = useViewMode();
if (isLoading) return <ローディング表示>;
return viewMode === 'kids' ? <KidsXxx /> : <AdultXxx />;
```

---

## 4. 設定ページ

**ファイル:** `app/settings/page.tsx`

- 大人用 / 子供用のモード切替ボタン（2択）
- 選択中のモードがハイライト表示
- ViewModeContext経由でSupabaseに保存

---

## 5. Tailwind CSS拡張

**ファイル:** `tailwind.config.ts`

追加したカスタムカラー:
- `kids-pink`: #FF6B9D
- `kids-yellow`: #FFD93D
- `kids-green`: #6BCF7F
- `kids-blue`: #4ECDC4
- `kids-purple`: #A78BFA

追加したフォント:
- `font-kids`: "M PLUS Rounded 1c"（丸ゴシック）

---

## 6. Supabaseマイグレーション

**ファイル:** `supabase/005_add_view_mode_column.sql`

```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS view_mode TEXT DEFAULT 'adult'
CHECK (view_mode IN ('adult', 'kids'));
```

- 既存データへの影響なし（デフォルト 'adult' が適用）
- CHECK制約で 'adult' と 'kids' のみ許可

---

## 7. 子供用医院情報ページ実装

**ファイル:** `components/(kids)/KidsInfoPage.tsx`

全セクションをひらがなで表記:
- せってい（モード切替リンク / kids-purple）
- びょういんのなまえ（つくばホワイトしか / kids-blue）
- ばしょ（いばらきけん つくばし / kids-green）
- やっているじかん（げつ〜ど 9:00〜18:00 / kids-yellow）
- おやすみのひ（にちようび・しゅくじつ / kids-pink）
- れんらくさき（ホームページリンク / kids-blue）

---

## 8. ハブラーシカ画像配置

**配置先:** `public/images/haburashika.jpg`

- プロジェクトルートの `ハブラーシカ.jpg` を `public/images/` にコピー
- `KidsStampPage` で `next/image` の `Image` コンポーネントとして使用（120x120）

---

## 9. 子供用スロットゲームボタン

**新規ファイル:**

| ファイル | 内容 |
|---------|------|
| `components/shared/KidsSlotButton.tsx` | 子供モード時のみ表示されるフローティングボタン |
| `app/slot/page.tsx` | スロットゲームページ（プレースホルダー） |

**KidsSlotButton の仕様:**
- 子供モード時のみ表示（`viewMode !== 'kids'` で非表示）
- ボトムナビの左上に固定配置（`bottom-[72px] left-4`）
- ピンク→パープルのグラデーション背景
- タップで `/slot` に遷移

**AppLayout.tsx への組み込み:**
- `ViewModeProvider` の内側に配置（useViewModeを使用するため）
- ボトムナビゲーションの直前に記述

---

## 10. その他の修正

- `app/settings/page.tsx`: モード切替時の `alert()` を削除（UIのハイライトで十分）
- `Doc/ファイル構成.md`: 現在の構成に全面更新

---

## ビルド結果

全13ルート正常にビルド完了:

```
Route (app)
├ /             (Static)
├ /stamp        (Static)
├ /rewards      (Static)
├ /care         (Static)
├ /info         (Static)
├ /settings     (Static)
├ /slot         (Static)
├ /api/stamps   (Dynamic)
├ /api/stamps/manual   (Dynamic)
├ /api/rewards         (Dynamic)
└ /api/rewards/exchange (Dynamic)
```

---

## デプロイ時の注意

**推奨手順: SQLマイグレーション → Vercelデプロイ**

1. Supabaseで `005_add_view_mode_column.sql` を実行（カラム追加のみ、既存データに影響なし）
2. Vercelにデプロイ

逆順でもアプリはクラッシュしないが、設定ページのモード切替がSQLを実行するまで機能しない。

---

## 関連ファイル

- [Kids_Mode_Specification.md](./Kids_Mode_Specification.md) - 子供用モード仕様書
- [ファイル構成.md](./ファイル構成.md) - 最新のファイル構成
