# 実装ログ（mio）

mio が実施した作業の記録。

---

## 2026-02-12: 環境セットアップ / スロットゲーム実装

### 開発環境セットアップ
- ngrok を npm でグローバルインストール（`npm install -g ngrok`）
- authtoken 設定（`C:\Users\mioyo\AppData\Local\ngrok\ngrok.yml`）
- Next.js dev server + ngrok トンネル起動確認

### 子供用スロットゲーム実装（app/slot/page.tsx）

**プレースホルダーから完全なゲームに置き換え。**

- 歯科テーマの絵文字リール 7種（🦷🪥🍎⭐💎🌸🍀）
  - 色・形がすべて異なるシンボルに変更（✨🌟😁🎀💎 → 🍎💎🌸🍀）
- **タップで自分で止める方式**
  - 「まわす！」ボタンで3リール一斉回転
  - 各リールをタップして任意のタイミングで停止
  - 3つ全部止めたら結果判定
- 当たりパターン（7種 + おしい判定）
  - 🦷🦷🦷 → だいあたり！「はが ピッカピカ！すごいね！」
  - 🪥🪥🪥 → あたり！「はみがき マスター！えらい！」
  - 🍎🍎🍎 → あたり！「りんご いっぱい！おいしいね！」
  - ⭐⭐⭐ → あたり！「おほしさま キラキラ！」
  - 💎💎💎 → あたり！「ダイヤモンド みたいにピカピカ！」
  - 🌸🌸🌸 → あたり！「おはな まんかい！きれいだね！」
  - 🍀🍀🍀 → あたり！「よつば の クローバー！ラッキー！」
  - 2つ揃い（隣接） → おしい！
- UI
  - 回転中ガイド「👆 タップして とめてね！」（パルスアニメーション付き）
  - 停止済みリールは緑枠、回転中はkids-yellow枠+パルス
  - ドットインジケーター（3つ）で停止状況を表示
  - 当たり時に紙吹雪エフェクト（30個の絵文字バウンス）
  - 結果パネル：当たり→黄色背景+ピンク文字、はずれ→グレー背景
  - kidsカラー・font-kids・ひらがな表記
  - 遊び方セクション追加
  - ハブラーシカ画像をヘッダーに表示（丸型+kids-yellow枠）
  - 「もどる」リンク（ArrowLeftアイコン付き）
- コンポーネント設計
  - `SlotReel` 独立コンポーネント（useRef でインターバル管理）
  - `spinKey` で再マウント制御（リプレイ時にリールをリセット）

### Doc / 設定ファイル更新

- `Doc/Implementation_Summary.md` に 2026-02-12 分を追記
  - LIFF環境分離（本番/テスト用LIFF ID）
  - ngrok導入
  - Docフォルダ整理（15→7ファイル+archive）
- `.claude/settings.local.json` に許可ルール追加
  - `curl`, `taskkill.exe`, `npx ngrok`, `git config` 等

---

## 2026-02-22: 診察券番号・本名フィールド追加

### オンボーディング画面の2ステップフロー化

**ファイル**: [app/onboarding/page.tsx](../app/onboarding/page.tsx)

**実装内容**:
- Step 1: 患者情報入力（診察券番号 + 本名）
- Step 2: 役割選択（親 or 子）
- プログレスインジケーター追加
- バリデーション機能（必須項目チェック）
- 2ステップ間の状態管理

**主な変更**:
```typescript
const [step, setStep] = useState<'profile' | 'role'>('profile');
const [ticketNumber, setTicketNumber] = useState('');
const [realName, setRealName] = useState('');
```

### API更新（役割設定時に診察券番号・本名を保存）

**ファイル**: [app/api/users/setup-role/route.ts](../app/api/users/setup-role/route.ts)

**実装内容**:
- リクエストボディに `ticketNumber` と `realName` を追加
- TypeScript型定義 `SetupRoleRequest` に新フィールド追加
- 親・子どちらの役割でもこれらのフィールドを保存
- NULL許可（任意入力）

**更新箇所**:
```typescript
interface SetupRoleRequest {
  userId: string;
  role: "parent" | "child";
  ticketNumber?: string; // 🆕
  realName?: string;     // 🆕
}
```

### TypeScript型定義の追加

**ファイル**: [types/profile.ts](../types/profile.ts) **(新規作成)**

**内容**:
- `UserProfile` インターフェース: Supabase `profiles` テーブルの完全な型定義
- `ProfileUpdate` インターフェース: プロフィール更新用の部分型
- `real_name` フィールドを追加

```typescript
export interface UserProfile {
  // ... 既存フィールド
  ticket_number?: string | null;
  real_name?: string | null;      // 🆕 本名（漢字）
  // ...
}
```

### 診察券画面に本名を表示

**ファイル**: [components/(adult)/AdultHome.tsx](../components/(adult)/AdultHome.tsx)

**実装内容**:
- Supabase クエリに `real_name` を追加
- `realName` ステートの追加
- 表示優先順位: 本名 > LINE表示名
- LINE表示名を小さく併記（本名と異なる場合のみ）

**主な変更**:
```typescript
// データ取得
.select("stamp_count, updated_at, ticket_number, family_id, real_name")

// 表示用データ
const displayName = realName || profile?.displayName ?? "ゲスト";

// UI表示
<p className="text-2xl font-semibold text-gray-800">{displayName}</p>
{realName && realName !== profile?.displayName && (
  <p className="text-xs text-gray-400">
    LINE表示名: {profile?.displayName}
  </p>
)}
```

### 設定画面でプロフィール編集機能を追加

**ファイル**: [app/settings/page.tsx](../app/settings/page.tsx)

**実装内容**:
- プロフィール情報セクションを新規追加（最上部に配置）
- 本名・診察券番号・LINE表示名を表示
- インライン編集機能（編集ボタン → 入力フォーム → 保存/キャンセル）
- Supabase 直接更新（`/api/users/[userId]/real-name` APIは不要と判断）
- バリデーション機能（必須項目チェック）

**主なUI**:
- 閲覧モード: お名前、診察券番号、LINE表示名を表示
- 編集モード: テキスト入力フィールド + 保存/キャンセルボタン
- アイコン: `User` (lucide-react), `Edit3`

**編集機能のコード**:
```typescript
const handleSaveProfile = async () => {
  const { error } = await supabase
    .from('profiles')
    .update({
      real_name: editRealName.trim(),
      ticket_number: editTicketNumber.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.userId);

  if (!error) {
    setRealName(editRealName.trim());
    setTicketNumber(editTicketNumber.trim());
    setIsEditingProfile(false);
    alert('プロフィールを更新しました');
  }
};
```

---

### データベース設計（参考）

**マイグレーションファイル**: [supabase/012_add_real_name_column.sql](../supabase/012_add_real_name_column.sql)

**追加カラム**:
- `real_name TEXT DEFAULT NULL` - 患者の本名（管理画面・LIFFアプリ共用）
- インデックス: `idx_profiles_real_name` (NULL を除外した部分インデックス)
- 検索関数: `search_profiles_by_real_name(TEXT)` - 大文字小文字を区別しない検索

**注意点**:
- `real_name_kana` カラムは実装しない（シンプルさ優先）
- 既存ユーザーは NULL のまま（後から入力可能）
- 個人情報のため適切なRLSポリシーで保護する

---

### 実装完了タスク

- ✅ オンボーディング画面に診察券番号と氏名の入力フォームを追加
- ✅ TypeScript型定義の更新（`real_name` 追加）
- ✅ 診察券画面に本名を表示するよう修正
- ✅ 設定画面から氏名を編集できるよう追加

---

### 技術メモ

**設計判断**:
1. **`real_name_kana` は不採用** - 入力の手間を減らすため本名（漢字）のみに
2. **API `/api/users/[userId]/real-name` は作成せず** - 設定画面で Supabase 直接更新のみ
3. **2ステップフローの採用** - UX向上（1画面に詰め込まない）
4. **表示優先順位** - 本名 > LINE表示名（医療機関としての正確性）

**今後の課題**:
- [ ] データベースマイグレーション `012_add_real_name_column.sql` の本番環境への適用
- [ ] 子供モード（KidsHome）への本名表示対応（必要に応じて）
- [ ] 管理画面での本名検索機能（`search_profiles_by_real_name` 関数の活用）
