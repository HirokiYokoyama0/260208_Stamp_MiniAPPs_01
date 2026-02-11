# LINE公式アカウント友だち登録促進機能 仕様書

## 概要

LIFF起動時に `liff.getFriendship()` を使用して、ユーザーが公式LINE（@550mlcao）を友だち登録しているかをチェックし、未登録の場合に登録を促す機能。

---

## 目的

1. **再来院促進**: 公式LINEからのリマインド通知を受け取れるユーザーを増やす
2. **エンゲージメント向上**: キャンペーン情報や特典のお知らせを配信
3. **医院側の把握**: 友だち登録状況をSupabaseで管理し、管理画面で集計可能

---

## ユーザーフロー

### パターン1: 初回起動時（友だち未登録の場合）

```
LIFF起動
  ↓
liff.getFriendship() でチェック
  ↓
friendFlag = false（友だちではない）
  ↓
2秒後に友だち登録促進モーダルを表示
  ↓
ユーザーが「友だち追加する」をタップ
  ↓
https://line.me/R/ti/p/@550mlcao を新しいタブで開く
  ↓
ユーザーが公式LINEを友だち追加
  ↓
アプリに戻る
```

### パターン2: 医院情報ページから登録

```
ユーザーが「医院情報」タブを開く
  ↓
「公式LINE」セクションが表示される
  ↓
友だち登録状態をチェック
  ↓
未登録の場合: 「友だち追加する」ボタンを表示
  ↓
ボタンをタップ → https://line.me/R/ti/p/@550mlcao を開く
```

---

## 技術仕様

### 1. liff.getFriendship() の使用

**LINE LIFF SDK の API:**

```typescript
const friendship = await liff.getFriendship();
console.log(friendship.friendFlag); // true or false
```

**friendFlag の意味:**
- `true`: ユーザーは公式LINEの友だち
- `false`: ユーザーは公式LINEの友だちではない

**注意事項:**
- この API は LIFF 2.1.0 以降で使用可能
- Messaging API の設定で「友だち追加オプション」が有効になっている必要がある
- LINE Developers Console で設定が必要

---

### 2. データベース設計

#### 新規カラム: `profiles.is_line_friend`

| カラム名 | 型 | デフォルト | 説明 |
|---------|---|----------|------|
| `is_line_friend` | BOOLEAN | NULL | 友だち登録状態のキャッシュ |

**値の意味:**
- `NULL`: まだ確認していない
- `true`: 公式LINEの友だち
- `false`: 公式LINEの友だちではない

**追加SQL:**
```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_line_friend BOOLEAN DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_is_line_friend
  ON profiles(is_line_friend)
  WHERE is_line_friend = true;
```

---

### 3. 実装ファイル

#### ファイル1: `hooks/useLiff.ts`

**追加機能:**
- `isFriend: boolean | null` をreturnに追加
- `checkFriendship()` 関数を追加
- 初回ログイン時に自動的に `liff.getFriendship()` を呼び出し
- 取得した `friendFlag` を Supabase に保存

**コード例:**
```typescript
const checkFriendship = useCallback(async () => {
  if (!liff.isLoggedIn()) {
    setIsFriend(null);
    return;
  }

  try {
    const friendship = await liff.getFriendship();
    setIsFriend(friendship.friendFlag);

    // Supabaseに保存
    await supabase
      .from("profiles")
      .update({ is_line_friend: friendship.friendFlag })
      .eq("id", profile.userId);
  } catch (err) {
    console.error("友だち状態の取得に失敗しました:", err);
    setIsFriend(null);
  }
}, [profile]);
```

---

#### ファイル2: `components/features/FriendshipPromptModal.tsx`

**機能:**
- 友だち登録を促すモーダルコンポーネント
- 「友だち追加する」ボタン → `https://line.me/R/ti/p/@550mlcao` を新しいタブで開く
- 「あとで追加する」ボタン → モーダルを閉じる

**デザイン:**
- ハブラーシカアイコン（ハートマーク）
- 友だち登録のメリット一覧
- LINEの公式カラー（#06C755）のボタン

---

#### ファイル3: `components/layout/AppLayout.tsx`

**追加機能:**
- 初回起動時に友だち登録促進モーダルを表示
- LocalStorageで「今日すでに表示したか」をチェック（1日1回まで）
- 2秒の遅延後に表示（UX改善）

**ロジック:**
```typescript
useEffect(() => {
  if (isLoggedIn && isFriend === false) {
    const today = new Date().toISOString().split("T")[0];
    const lastShown = localStorage.getItem("friendshipPromptLastShown");

    if (lastShown !== today) {
      setTimeout(() => {
        setShowFriendshipModal(true);
        localStorage.setItem("friendshipPromptLastShown", today);
      }, 2000);
    }
  }
}, [isLoggedIn, isFriend]);
```

---

#### ファイル4: `app/info/page.tsx`

**実装内容:**
- 「公式LINE」セクションを追加
- 友だち登録状態に応じて表示を切り替え
  - `isFriend === true`: 「友だち登録済みです」（チェックマーク表示）
  - `isFriend === false`: 「友だち追加する」ボタンを表示
  - `isFriend === null`: 「確認中...」

**デザイン:**
- プライマリカラー（スカイブルー）の枠線とアクセント
- LINEの公式カラー（#06C755）のボタン
- ハートアイコンで親しみやすさを演出

---

## UX設計

### 表示タイミング

| シーン | 表示条件 | 頻度 |
|-------|---------|------|
| **初回起動時モーダル** | `isFriend === false` | 1日1回（LocalStorageで管理） |
| **医院情報ページ** | `isFriend === false` | 常に表示 |

### 1日1回制限の理由

**メリット:**
- ユーザーに対して過度に干渉しない
- UXを損なわない

**実装:**
```typescript
const today = new Date().toISOString().split("T")[0]; // "2026-02-09"
const lastShown = localStorage.getItem("friendshipPromptLastShown");

if (lastShown !== today) {
  // モーダル表示
  localStorage.setItem("friendshipPromptLastShown", today);
}
```

---

## 友だち追加の流れ

### ステップ1: ボタンをタップ

```typescript
const handleAddFriend = () => {
  window.open("https://line.me/R/ti/p/@550mlcao", "_blank");
};
```

### ステップ2: LINE公式アカウントページを開く

- LINEアプリが起動（モバイルの場合）
- または、LINEのWebページが開く（デスクトップの場合）

### ステップ3: 「追加」ボタンをタップ

ユーザーが公式LINEを友だち追加します。

### ステップ4: アプリに戻る

ユーザーがLIFFアプリに戻ります。

### ステップ5: 次回起動時

次回LIFF起動時に `liff.getFriendship()` を再度呼び出すと、`friendFlag = true` になります。

---

## セキュリティとプライバシー

### 個人情報の取り扱い

- `liff.getFriendship()` は友だち状態のみを返す（個人情報は含まない）
- Supabaseに保存するのは `true/false` のフラグのみ

### エラーハンドリング

```typescript
try {
  const friendship = await liff.getFriendship();
  setIsFriend(friendship.friendFlag);
} catch (err) {
  console.error("友だち状態の取得に失敗しました:", err);
  setIsFriend(null); // エラー時は null（未確認）として扱う
}
```

---

## 運用設計

### 1. 友だち登録状況の確認

**Supabase SQL Editor で実行:**

```sql
-- 友だち登録済みユーザー数
SELECT COUNT(*) FROM profiles WHERE is_line_friend = true;

-- 友だち未登録ユーザー数
SELECT COUNT(*) FROM profiles WHERE is_line_friend = false;

-- 未確認ユーザー数
SELECT COUNT(*) FROM profiles WHERE is_line_friend IS NULL;

-- 友だち登録率
SELECT
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE is_line_friend = true) / COUNT(*),
    2
  ) AS friend_rate_percent
FROM profiles;
```

### 2. 友だち登録状況の更新

**ユーザーが手動で「友だち追加する」を押した後:**
- 次回LIFF起動時に `liff.getFriendship()` が自動的に呼ばれる
- `is_line_friend` が自動的に更新される

**強制的に再確認:**
```typescript
const { checkFriendship } = useLiff();
await checkFriendship(); // 手動で再確認
```

---

## トラブルシューティング

### Q1: 友だち登録したのに `isFriend` が `false` のまま

**A:** `liff.getFriendship()` の結果がキャッシュされている可能性があります。
- アプリを再起動してください
- または、医院情報ページを開いて再確認してください

### Q2: モーダルが表示されない

**A:** 以下を確認してください：
1. `isFriend` が `false` か確認
2. LocalStorageに `friendshipPromptLastShown` が今日の日付で保存されていないか確認
3. ブラウザのコンソールでエラーがないか確認

**LocalStorageをクリア（開発時のみ）:**
```javascript
localStorage.removeItem("friendshipPromptLastShown");
```

### Q3: `liff.getFriendship()` でエラーが発生する

**A:** LINE Developers Console の設定を確認してください：
- Messaging API の「友だち追加オプション」が有効か
- LIFF アプリの設定が正しいか

---

## LINE Developers Console の設定

### 必須設定

1. **LINE公式アカウントの作成**
   - アカウント名: つくばホワイト歯科
   - LINE ID: @550mlcao

2. **Messaging API の有効化**
   - LINE Developers Console で Messaging API を有効にする

3. **友だち追加オプションの有効化**
   - LIFF の設定で「友だち追加オプション」を ON にする

4. **LIFF ID の取得**
   - `.env.local` に `NEXT_PUBLIC_LIFF_ID` を設定

---

## 今後の拡張案

### Phase 1: プッシュ通知機能（将来実装）

友だち登録済みユーザーに対して、以下の通知を送信：
- 定期検診のリマインド（3ヶ月後）
- 特典交換可能通知
- キャンペーン情報

### Phase 2: 管理画面での確認

管理画面で以下の情報を表示：
- 友だち登録率
- 友だち登録済みユーザー一覧
- 友だち未登録ユーザー一覧

### Phase 3: セグメント配信

友だち登録状況に応じて、配信対象を絞り込む：
- 友だち登録済み → リマインド通知を送信
- 友だち未登録 → 受付で直接フォローを促す

---

## 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-02-09 | 初版作成 |

---

## 関連ファイル

- [hooks/useLiff.ts](../hooks/useLiff.ts)
- [components/features/FriendshipPromptModal.tsx](../components/features/FriendshipPromptModal.tsx)
- [components/layout/AppLayout.tsx](../components/layout/AppLayout.tsx)
- [app/info/page.tsx](../app/info/page.tsx)
- [supabase/004_add_is_line_friend_column.sql](../supabase/004_add_is_line_friend_column.sql)
