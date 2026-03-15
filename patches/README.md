# キッズモード「戻るボタン」パッチ

## 概要
キッズモード全画面に「おやのがめんにもどる」ボタンを追加するパッチです。

## 作業バッティング防止のため
- このパッチは **59a9568（地図リンク修正）以降の作業** に対応
- キッズ担当者の作業完了後に適用してください
- コンフリクトが発生した場合は手動マージが必要です

## 変更ファイル（5ファイル、+105/-6行）
- `components/(kids)/KidsHome.tsx` - 条件を `selectedChildId` → `viewMode === 'kids'` に変更
- `components/(kids)/KidsStampPage.tsx` - 戻るボタン追加
- `components/(kids)/KidsRewardsPage.tsx` - 戻るボタン追加
- `components/(kids)/KidsCarePage.tsx` - 戻るボタン追加
- `components/(kids)/KidsInfoPage.tsx` - 戻るボタン追加

## 適用方法

### 1. パッチの内容を確認
```bash
cat patches/kids-back-button.patch
```

### 2. 適用前のテスト（dry-run）
```bash
git apply --check patches/kids-back-button.patch
```

### 3. パッチを適用
```bash
git apply patches/kids-back-button.patch
```

### 4. コンフリクトが発生した場合
```bash
# 3-way mergeで適用を試す
git apply --3way patches/kids-back-button.patch

# それでも無理な場合は手動マージ
# パッチファイルの内容を参考に手動で変更してください
```

## 変更内容の詳細

### 共通追加コード
全ページに以下のインポートとハンドラを追加：

```typescript
import { useViewMode } from "@/contexts/ViewModeContext";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// 親の画面に戻る
const handleBackToParent = async () => {
  setSelectedChildId(null);
  await setViewMode('adult');
  router.push('/');
};
```

### ボタンUI
```tsx
{viewMode === 'kids' && (
  <div className="mb-4">
    <button
      onClick={handleBackToParent}
      className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-kids-purple shadow-lg transition-all hover:bg-white active:scale-95"
    >
      <ArrowLeft size={20} />
      おやの がめんに もどる
    </button>
  </div>
)}
```

## 作成日時
2025-03-15

## 作成者
Claude (AI Assistant)

## 備考
- このパッチは `8de2176 fix: キッズモードでケア記録タブを有効化` の時点のコードベースで作成されています
- キッズ担当者の作業との整合性を確認してから適用してください
