# Phase 2: 家族紐付け機能 実装計画書

**作成日**: 2026-02-17
**最終更新**: 2026-02-18
**ステータス**: ✅ Phase 2 実装完了（代理管理メンバー機能含む）
**前提**: Phase 1（10倍整数システム）実装済み

---

## 📋 目次

1. [概要](#概要)
2. [実装の全体フロー](#実装の全体フロー)
3. [API実装](#api実装)
4. [UI実装](#ui実装)
5. [実装順序](#実装順序)
6. [テスト項目](#テスト項目)

---

## 概要

### Phase 2 の目的

親子で協力してスタンプを貯める「家族連携機能」を実装する。

### 主な機能

1. **初回登録時の役割選択** - 親 or 子を選択
2. **家族の作成** - 親が新規家族を作成
3. **家族への参加** - 子が招待コードで家族に参加
4. **家族スタンプ合算表示** - 家族メンバー全員のスタンプを合計
5. **家族管理** - メンバー一覧、追加、削除、家族名変更

---

## 実装の全体フロー

```
初回登録 → 役割選択（親 or 子） → 家族作成 or 家族参加 → ホーム画面
```

### フロー詳細

#### パターンA: 保護者（親）の場合

```
1. 初回ログイン
   ↓
2. /onboarding で「保護者」を選択
   ↓
3. API: /api/users/setup-role (role: 'parent')
   - 新規家族を自動作成
   - profiles.family_role = 'parent' に設定
   ↓
4. ホーム画面へリダイレクト
```

#### パターンB: 子どもの場合

```
1. 初回ログイン
   ↓
2. /onboarding で「お子様」を選択
   ↓
3. API: /api/users/setup-role (role: 'child')
   - profiles.family_role = 'child' に設定
   ↓
4. /family/join へリダイレクト
   ↓
5. 招待コードを入力
   ↓
6. API: /api/families/join
   - profiles.family_id を設定
   ↓
7. ホーム画面へリダイレクト
```

---

## 代理管理メンバー機能（旧称：仮想メンバー）

### 概要

**目的**: スマホを持たない子供を親のアカウントで管理

**課題と解決策**:
- 子供がLINEアカウント/スマホを持っていない
- でも診察券番号は発行されている（電子カルテとの照合に必要）
- 親のスマホで子供のスタンプを管理したい

**解決策**:
- 親の「家族管理」画面から子供を追加
- profiles テーブルに `line_user_id = NULL` かつ `id = 'manual-child-${UUID}'` で登録
- 診察券番号は**必須入力**（電子カルテとの照合のため）
- 親のスマホで「子供の画面」を開いてスロットゲーム
- Supabaseで家族合計に自動集計

### ユーザーフロー

#### 1. 子供を追加する（親の操作）

```
親のスマホ:
設定 → 家族管理 → [+ 子供を追加]
       ↓
┌─────────────────────────────────────┐
│ 子供を追加                           │
├─────────────────────────────────────┤
│ この子はスマホを持っていません         │
│ あなたが代わりに管理します            │
│                                      │
│ 名前: [横山太郎        ]              │
│                                      │
│ 診察券番号: [123460        ]          │
│                                      │
│ [保存] [キャンセル]                  │
└─────────────────────────────────────┘
```

#### 2. 子供の画面を開く（親の操作）

**方法A: 家族管理画面から**
- 「開く」ボタンをタップ
- ViewMode を 'kids' に切り替え + selectedChildId を保存
- ホーム画面にリダイレクト
- 子供専用のキッズモード画面が表示

**方法B: 設定画面から（推奨）**
- 「子供の画面」セクションでボタンをタップ
- ViewMode を 'kids' に切り替え + selectedChildId を保存
- ホーム画面にリダイレクト

#### 3. 親の画面に戻る

- キッズモード画面で「おやの がめんに もどる」ボタンをタップ
- selectedChildId をクリア + ViewMode を 'adult' に切り替え
- ホーム画面にリダイレクト

### データベース設計

```sql
-- 手動登録の子供（代理管理メンバー）
INSERT INTO profiles VALUES (
  'manual-child-3a1222c0-8a02-4a70-91a0-0b2e4b447dd4',  -- 手動生成ID
  NULL,                         -- line_user_id = NULL
  '横山スマホなしこ',
  '445566',                     -- 診察券番号（必須）
  NULL,                         -- 画像なし
  0,                            -- 0個
  0,
  NULL,
  NULL,
  NULL,
  'fbaae6e8-e64f-4748-81b8-dbb455393b1e',  -- family_id
  'child',
  'kids',                       -- 子供モード固定
  NOW(),
  NOW()
);
```

### API実装（代理管理メンバー用）

#### POST /api/families/members/add

**子供を追加する**

**リクエスト:**
```json
{
  "userId": "U5c70cd61f4fe89a65381cd7becee8de3",
  "childName": "横山太郎",
  "ticketNumber": "123460"
}
```

**処理:**
1. バリデーション: userId, childName, ticketNumber が必須
2. userId が親（family_role = 'parent'）であることを確認
3. 手動IDを生成: `manual-child-${crypto.randomUUID()}`
4. profiles テーブルに INSERT

#### PATCH /api/families/members/[memberId]

**子供の情報を編集**

**条件:**
- userId が親であること
- memberId が親の家族メンバーであること
- memberId の line_user_id が NULL であること（手動登録のみ編集可）

#### DELETE /api/families/members/[memberId]（拡張）

**安全な削除処理:**

```typescript
import { isProxyMember } from '@/lib/members';

if (isProxyMember(member)) {
  // 代理管理メンバー → 完全削除（安全チェック付き）
  await supabase.from('profiles').delete().eq('id', memberId);
} else {
  // 実メンバー → family_id を NULL に（紐付け解除のみ）
  await supabase.from('profiles').update({
    family_id: null,
    family_role: null
  }).eq('id', memberId);
}
```

**判定関数（lib/members.ts）:**
```typescript
export const isProxyMember = (profile: { id: string; line_user_id: string | null }) => {
  // 二重チェック: line_user_id が NULL かつ ID が manual- で始まる
  return profile.line_user_id === null && profile.id.startsWith('manual-');
};
```

### UI実装（代理管理メンバー用）

#### 1. AddChildDialog.tsx

- 名前入力（必須）
- 診察券番号入力（必須）
- バリデーション

#### 2. app/family/manage/page.tsx

- 「子供を追加」ボタン
- メンバーカードに「開く」「編集」「削除」ボタン
- 代理管理メンバーの場合のみ「開く」ボタンを表示

#### 3. app/settings/page.tsx

**「子供の画面」セクション:**
- 表示条件: family_id != NULL && family_role = 'parent' && 代理管理メンバー1人以上
- ボタンタップで子供の画面に切り替え

#### 4. components/(kids)/KidsHome.tsx

- selectedChildId に基づいて子供のデータを表示
- 診察券番号、次回予約日、スタンプカードを表示
- 「おやの がめんに もどる」ボタン

### ViewModeContext の実装

**状態管理:**
```typescript
const [viewMode, setViewModeState] = useState<'adult' | 'kids'>('adult');
const [selectedChildId, setSelectedChildIdState] = useState<string | null>(null);
```

**LocalStorage との同期:**
- `selectedChildId` は LocalStorage に保存
- ページリロード時に復元

---

## API実装

### 1. ユーザー情報取得API（強化）

**ファイル**: `app/api/users/me/route.ts`

**エンドポイント**: `GET /api/users/me`

**説明**: 現在のユーザー情報 + 家族情報を取得

**レスポンス例**:
```json
{
  "profile": {
    "id": "U3c2f1a651af...",
    "display_name": "横山浩紀",
    "family_id": "6ae90eb7-7076-4da0-8124-33b3a5df18ac",
    "family_role": "parent",
    "families": {
      "id": "6ae90eb7-7076-4da0-8124-33b3a5df18ac",
      "family_name": "横山家",
      "representative_user_id": "U3c2f1a651af..."
    }
  }
}
```

**実装コード**:
```typescript
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.user_metadata?.line_user_id;

  // プロフィール + 家族情報を取得
  const { data: profile } = await supabase
    .from("profiles")
    .select(`
      *,
      families:family_id (
        id,
        family_name,
        representative_user_id
      )
    `)
    .eq("id", userId)
    .single();

  return Response.json({ profile });
}
```

---

### 2. 初回登録・役割設定API

**ファイル**: `app/api/users/setup-role/route.ts`

**エンドポイント**: `POST /api/users/setup-role`

**リクエストボディ**:
```json
{
  "role": "parent" // または "child"
}
```

**レスポンス例（親の場合）**:
```json
{
  "success": true,
  "family": {
    "id": "6ae90eb7-7076-4da0-8124-33b3a5df18ac",
    "family_name": "横山浩紀の家族",
    "representative_user_id": "U3c2f1a651af..."
  }
}
```

**レスポンス例（子の場合）**:
```json
{
  "success": true,
  "needsJoin": true
}
```

**実装コード**:
```typescript
export async function POST(request: Request) {
  const { role } = await request.json(); // 'parent' or 'child'
  const supabase = await createClient();
  const userId = /* LINE User ID */;

  if (role === 'parent') {
    // 親の場合: 新規家族を自動作成
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .single();

    // 家族を作成
    const { data: newFamily } = await supabase
      .from("families")
      .insert({
        family_name: `${profile.display_name}の家族`,
        representative_user_id: userId,
      })
      .select()
      .single();

    // プロフィールを更新
    await supabase
      .from("profiles")
      .update({
        family_id: newFamily.id,
        family_role: 'parent',
      })
      .eq("id", userId);

    return Response.json({ success: true, family: newFamily });
  } else {
    // 子の場合: family_role だけ設定
    await supabase
      .from("profiles")
      .update({ family_role: 'child' })
      .eq("id", userId);

    return Response.json({ success: true, needsJoin: true });
  }
}
```

---

### 3. 家族参加API（子ども用）

**ファイル**: `app/api/families/join/route.ts`

**エンドポイント**: `POST /api/families/join`

**リクエストボディ**:
```json
{
  "inviteCode": "6ae90eb7-7076-4da0-8124-33b3a5df18ac"
}
```

**レスポンス例（成功）**:
```json
{
  "success": true,
  "family": {
    "id": "6ae90eb7-7076-4da0-8124-33b3a5df18ac",
    "family_name": "横山家"
  }
}
```

**レスポンス例（エラー）**:
```json
{
  "error": "Invalid invite code"
}
```

**実装コード**:
```typescript
export async function POST(request: Request) {
  const { inviteCode } = await request.json();
  const supabase = await createClient();
  const userId = /* LINE User ID */;

  // 招待コードから家族を検索
  const { data: family } = await supabase
    .from("families")
    .select("*")
    .eq("id", inviteCode)
    .single();

  if (!family) {
    return Response.json({ error: "Invalid invite code" }, { status: 400 });
  }

  // プロフィールを更新
  await supabase
    .from("profiles")
    .update({
      family_id: family.id,
      family_role: 'child',
    })
    .eq("id", userId);

  return Response.json({ success: true, family });
}
```

---

### 4. 家族情報取得API

**ファイル**: `app/api/families/me/route.ts`

**エンドポイント**: `GET /api/families/me`

**レスポンス例**:
```json
{
  "family": {
    "id": "6ae90eb7-7076-4da0-8124-33b3a5df18ac",
    "family_name": "横山家",
    "representative_user_id": "U3c2f1a651af...",
    "members": [
      {
        "id": "U3c2f1a651af...",
        "display_name": "横山浩紀",
        "family_role": "parent",
        "stamp_count": 120,
        "visit_count": 12
      },
      {
        "id": "U1234567890...",
        "display_name": "横山太郎",
        "family_role": "child",
        "stamp_count": 80,
        "visit_count": 8
      }
    ]
  }
}
```

**実装コード**:
```typescript
export async function GET() {
  const supabase = await createClient();
  const userId = /* LINE User ID */;

  // 自分の家族情報を取得
  const { data: profile } = await supabase
    .from("profiles")
    .select("family_id")
    .eq("id", userId)
    .single();

  if (!profile?.family_id) {
    return Response.json({ error: "No family" }, { status: 404 });
  }

  // 家族情報 + メンバー一覧を取得
  const { data: family } = await supabase
    .from("families")
    .select(`
      *,
      members:profiles!family_id (
        id,
        display_name,
        family_role,
        stamp_count,
        visit_count
      )
    `)
    .eq("id", profile.family_id)
    .single();

  return Response.json({ family });
}
```

---

### 5. 家族メンバー管理API（親専用）

**ファイル**: `app/api/families/members/route.ts`

**エンドポイント**: `DELETE /api/families/members`

**リクエストボディ**:
```json
{
  "memberId": "U1234567890..."
}
```

**レスポンス例**:
```json
{
  "success": true
}
```

**実装コード**:
```typescript
export async function DELETE(request: Request) {
  const { memberId } = await request.json();
  const supabase = await createClient();
  const userId = /* LINE User ID */;

  // 自分が代表者か確認
  const { data: profile } = await supabase
    .from("profiles")
    .select("family_id, family_role")
    .eq("id", userId)
    .single();

  if (profile.family_role !== 'parent') {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  // メンバーを家族から削除
  await supabase
    .from("profiles")
    .update({ family_id: null })
    .eq("id", memberId)
    .eq("family_id", profile.family_id);

  return Response.json({ success: true });
}
```

---

### 6. 家族名変更API（親専用）

**ファイル**: `app/api/families/update/route.ts`

**エンドポイント**: `PATCH /api/families/update`

**リクエストボディ**:
```json
{
  "familyName": "新しい家族名"
}
```

**レスポンス例**:
```json
{
  "success": true
}
```

**実装コード**:
```typescript
export async function PATCH(request: Request) {
  const { familyName } = await request.json();
  const supabase = await createClient();
  const userId = /* LINE User ID */;

  // 自分の家族を取得
  const { data: profile } = await supabase
    .from("profiles")
    .select("family_id, family_role")
    .eq("id", userId)
    .single();

  if (profile.family_role !== 'parent') {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  // 家族名を更新
  await supabase
    .from("families")
    .update({ family_name: familyName })
    .eq("id", profile.family_id);

  return Response.json({ success: true });
}
```

---

## UI実装

### 1. 初回登録画面

**ファイル**: `app/onboarding/page.tsx`

**画面説明**:
- ユーザーが「保護者（親）」または「お子様」を選択する画面
- 初回ログイン時に表示される

**主要コンポーネント**:
- 保護者ボタン（User アイコン）
- お子様ボタン（Baby アイコン）

**実装のポイント**:
```typescript
const handleSelectRole = async (role: 'parent' | 'child') => {
  const res = await fetch('/api/users/setup-role', {
    method: 'POST',
    body: JSON.stringify({ role }),
  });

  if (role === 'parent') {
    router.push('/');  // 親 → ホーム画面
  } else {
    router.push('/family/join');  // 子 → 家族参加画面
  }
};
```

---

### 2. 家族参加画面（子ども用）

**ファイル**: `app/family/join/page.tsx`

**画面説明**:
- 子どもが招待コードを入力して家族に参加する画面
- QRコード読み取り機能も将来追加可能

**主要コンポーネント**:
- 招待コード入力フィールド
- 参加ボタン
- QRコード読み取りボタン（将来実装）

**実装のポイント**:
```typescript
const handleJoin = async () => {
  const res = await fetch('/api/families/join', {
    method: 'POST',
    body: JSON.stringify({ inviteCode }),
  });

  if (res.ok) {
    router.push('/');  // 成功 → ホーム画面
  } else {
    setError('招待コードが無効です');
  }
};
```

---

### 3. 家族管理画面（親専用）

**ファイル**: `app/family/manage/page.tsx`

**画面説明**:
- 家族名の変更
- 招待コードの表示・コピー
- メンバー一覧の表示
- メンバーの削除（子どものみ）

**主要コンポーネント**:
- 家族名編集フォーム
- 招待コード表示エリア
- メンバーカード（リスト）
- 削除ボタン

**実装のポイント**:
```typescript
// 家族情報の取得
useEffect(() => {
  fetch('/api/families/me')
    .then(res => res.json())
    .then(data => setFamily(data.family));
}, []);

// メンバー削除
const handleRemoveMember = async (memberId: string) => {
  await fetch('/api/families/members', {
    method: 'DELETE',
    body: JSON.stringify({ memberId }),
  });
  fetchFamily();  // 再取得
};
```

---

### 4. ホーム画面の修正

**ファイル**: `components/(adult)/AdultHome.tsx`

**追加要素**:
- 家族スタンプ合計の表示セクション

**実装のポイント**:
```tsx
const { data: familyTotal } = useSWR('/api/families/me');

// 家族スタンプセクション
{familyTotal && (
  <section className="mb-6 bg-gradient-to-r from-primary/10 to-sky-50 rounded-lg p-4">
    <div className="flex items-center gap-2 mb-2">
      <Users className="text-primary" size={20} />
      <h3 className="font-semibold text-gray-800">家族のスタンプ</h3>
    </div>
    <p className="text-3xl font-bold text-primary">
      {Math.floor(familyTotal.total_stamp_count / 10)}個
    </p>
    <p className="text-sm text-gray-600">
      {familyTotal.member_count}人で協力中
    </p>
  </section>
)}
```

---

### 5. 設定画面の修正

**ファイル**: `app/settings/page.tsx`

**変更内容**:
- ❌ 削除: 「表示モードの切り替え」セクション
- ✅ 追加: 「家族管理」リンク

**実装のポイント**:
```tsx
<Link
  href="/family/manage"
  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4"
>
  <Users className="text-primary" size={20} />
  <div className="flex-1">
    <p className="font-semibold">家族管理</p>
    <p className="text-xs text-gray-500">
      {profile?.family_role === 'parent'
        ? 'メンバーの追加・削除'
        : '家族情報を確認'}
    </p>
  </div>
</Link>
```

---

## 実装順序

### ステップ1: API実装（バックエンド）

優先順位順に実装：

1. ✅ `app/api/users/me/route.ts` - 家族情報取得機能追加
2. ✅ `app/api/users/setup-role/route.ts` - 役割設定API
3. ✅ `app/api/families/join/route.ts` - 家族参加API
4. ✅ `app/api/families/me/route.ts` - 家族詳細取得API
5. ✅ `app/api/families/update/route.ts` - 家族名変更API
6. ✅ `app/api/families/members/route.ts` - メンバー管理API

**所要時間**: 1-2日

---

### ステップ2: UI実装（フロントエンド）

優先順位順に実装：

1. ✅ `app/onboarding/page.tsx` - 初回登録画面
2. ✅ `app/family/join/page.tsx` - 家族参加画面
3. ✅ `app/family/manage/page.tsx` - 家族管理画面
4. ✅ `components/(adult)/AdultHome.tsx` - ホーム画面修正
5. ✅ `app/settings/page.tsx` - 設定画面修正

**所要時間**: 2-3日

---

### ステップ3: フロー制御

1. ✅ 初回ログイン時に `/onboarding` へリダイレクト
2. ✅ `family_role` が NULL の場合に `/onboarding` へ誘導
3. ✅ 子どもが `family_id` が NULL の場合に `/family/join` へ誘導

**所要時間**: 0.5日

---

### ステップ4: テスト・デバッグ

1. ✅ 親の登録フロー
2. ✅ 子の登録・参加フロー
3. ✅ 家族管理機能
4. ✅ スタンプ合算表示

**所要時間**: 1日

---

**合計所要時間**: 4.5-6.5日

---

## テスト項目

### 1. 初回登録フロー

| テストケース | 手順 | 期待結果 |
|------------|------|---------|
| 親の新規登録 | 初回ログイン → 「保護者」選択 | 家族が自動作成される |
| 子の新規登録 | 初回ログイン → 「お子様」選択 | 家族参加画面へ遷移 |

### 2. 家族参加フロー

| テストケース | 手順 | 期待結果 |
|------------|------|---------|
| 正しい招待コード | 有効なコードを入力 → 参加 | 家族に参加、ホーム画面へ |
| 無効な招待コード | 無効なコードを入力 → 参加 | エラーメッセージ表示 |

### 3. 家族管理機能

| テストケース | 手順 | 期待結果 |
|------------|------|---------|
| 家族名変更（親） | 家族名を編集 → 保存 | 家族名が更新される |
| メンバー削除（親） | 子を削除 | 子の family_id が NULL になる |
| 家族名変更（子） | 家族名編集を試みる | 編集ボタンが表示されない |

### 4. スタンプ合算表示

| テストケース | 手順 | 期待結果 |
|------------|------|---------|
| 家族合計スタンプ表示 | ホーム画面を開く | 家族全員のスタンプ合計が表示される |
| メンバー別スタンプ表示 | 家族管理画面を開く | 各メンバーのスタンプが表示される |

### 5. 外部キー整合性

| テストケース | 手順 | 期待結果 |
|------------|------|---------|
| 家族削除時の整合性 | 家族を削除 | profiles.family_id が NULL になる（ON DELETE SET NULL） |
| 存在しない家族への参加 | 存在しない family_id を設定 | エラーが発生する |

### 6. 代理管理メンバー機能

| テストケース | 手順 | 期待結果 |
|------------|------|---------|
| 子供の追加（親） | 名前・診察券番号を入力 → 保存 | line_user_id = NULL で子供が作成される |
| 子供の編集（親） | 子供の情報を編集 → 保存 | 子供の名前・診察券番号が更新される |
| 子供の削除（親） | 子供を削除 | profiles テーブルから完全削除される |
| 実メンバーの削除（親） | LINEアカウントを持つ子を削除 | family_id が NULL になる（完全削除されない） |
| 子供の画面切替（親） | 家族管理画面で「開く」をタップ | キッズモードに切り替わる |
| 子供の画面切替（親） | 設定画面で子供ボタンをタップ | キッズモードに切り替わる |
| 子供の画面表示 | キッズモード画面を開く | 子供の名前・診察券番号・スタンプが表示される |
| 親の画面に戻る | 「おやの がめんに もどる」をタップ | 大人用画面に戻る |
| 家族合計への反映 | 代理管理メンバーのスタンプを確認 | 家族合計に含まれている |

---

## 今後の拡張案

### Phase 3 以降で検討

1. **QRコードでの家族参加**
   - 招待コードをQRコード化
   - カメラで読み取って参加

2. **家族招待メッセージ**
   - LINEメッセージで招待リンクを送信

3. **家族ランキング**
   - 家族単位でのランキング表示

4. **複数の親（共同管理）**
   - 夫婦で共同管理できる機能

5. **家族イベント**
   - 家族全員が来院したら特別ボーナス

---

## 関連ドキュメント

- [20_家族ひもづけ仕様検討.md](./20_家族ひもづけ仕様検討.md) - Phase 2 の仕様書
- [21_家族ひもづけ機能_管理ダッシュボード仕様書.md](./21_家族ひもづけ機能_管理ダッシュボード仕様書.md) - 管理側の仕様
- [05_Database_Schema.md](./05_Database_Schema.md) - データベーススキーマ
- [23_データベーススキーマ現状.md](./23_データベーススキーマ現状.md) - 現在のスキーマ状態

---

**最終更新**: 2026-02-18
**ステータス**: ✅ Phase 2 実装完了（代理管理メンバー機能含む）

---

## ✅ 実装完了サマリー（2026-02-17）

### データベース実装
- ✅ `supabase/009_add_family_support.sql` - families テーブル、profiles への family_id/family_role 追加
- ✅ `supabase/009_fix_rls_policies.sql` - RLS ポリシー修正（auth.uid()問題の解決）
- ✅ family_stamp_totals ビュー - 家族スタンプ合計の自動集計

### API実装（10本）
- ✅ `app/api/users/me/route.ts` - ユーザー情報+家族情報取得
- ✅ `app/api/users/setup-role/route.ts` - 初回登録・ロール設定
- ✅ `app/api/families/join/route.ts` - 家族参加（子ども用）
- ✅ `app/api/families/me/route.ts` - 家族詳細+メンバー一覧取得
- ✅ `app/api/families/update/route.ts` - 家族名変更（親専用）
- ✅ `app/api/families/members/route.ts` - メンバー削除（親専用）
- ✅ `app/api/families/members/add/route.ts` - 代理管理メンバー追加（親専用）
- ✅ `app/api/families/members/[memberId]/route.ts` - 代理管理メンバー編集・削除
- ✅ `app/api/profiles/[profileId]/route.ts` - プロフィール情報取得
- ✅ `lib/members.ts` - 代理管理メンバー判定関数

### UI実装（3ページ + 設定画面修正 + 代理管理メンバー機能）
- ✅ `app/onboarding/page.tsx` - 初回ロール選択画面（親/子）
- ✅ `app/family/join/page.tsx` - 家族参加画面（招待コード入力）
- ✅ `app/family/manage/page.tsx` - 家族管理画面（親専用）
- ✅ `app/settings/page.tsx` - 家族管理リンク + 子供の画面セクション追加
- ✅ `components/AddChildDialog.tsx` - 代理管理メンバー追加ダイアログ
- ✅ `components/(kids)/KidsHome.tsx` - selectedChildId対応 + 家族スタンプ表示
- ✅ `components/(kids)/KidsStampPage.tsx` - selectedChildId対応
- ✅ `contexts/ViewModeContext.tsx` - selectedChildId管理

### テスト環境構築
- ✅ ngrok トンネル起動（ポート4000）
- ✅ LIFF エンドポイントURL設定（テスト環境）
- ✅ デバッグログ追加（useLiff.ts, ViewModeContext.tsx）

### 技術的な修正
- ✅ TEXT型への統一（families.id を UUID → TEXT に変更）
- ✅ RLS ポリシー簡略化（`USING (true)` パターン）
- ✅ トリガー関数追加（families.updated_at の自動更新）
