# RPC関数 vs RLSポリシー：詳細解説

## 📋 目次

1. [基本概念](#基本概念)
2. [具体例で理解する](#具体例で理解する)
3. [現在のアプリでの実装方法](#現在のアプリでの実装方法)
4. [どちらを選ぶべきか](#どちらを選ぶべきか)
5. [推奨アプローチ](#推奨アプローチ)

---

## 基本概念

### RLSポリシー（Row Level Security Policy）

**データベース側でアクセスを制限する仕組み**

```
クライアント（ブラウザ）
  ↓ ANON_KEYでリクエスト
Supabase
  ↓ RLSポリシーでチェック
  ├─ ✅ 条件を満たす → アクセス許可
  └─ ❌ 条件を満たさない → アクセス拒否
データベース
```

**特徴：**
- データベースのテーブルごとに設定
- クライアントから直接テーブルにアクセス可能
- コード変更が少ない
- SQLで条件を記述

---

### RPC関数（Remote Procedure Call）

**データベース側に関数を作成し、その関数経由でのみアクセスを許可する仕組み**

```
クライアント（ブラウザ）
  ↓ ANON_KEYでRPC関数を呼び出し
Supabase
  ↓ RPC関数内でアクセス制御
PostgreSQL関数（SECURITY DEFINER）
  ↓ 関数内で条件チェック
  ├─ ✅ 条件を満たす → データを返す
  └─ ❌ 条件を満たさない → エラーを返す
データベース
```

**特徴：**
- テーブルへの直接アクセスを禁止
- RPC関数経由でのみアクセス
- より細かい制御が可能
- クライアント側のコード変更が大量に必要

---

## 具体例で理解する

### 例：「自分のスタンプ履歴だけを取得する」

#### ❌ 現在の状態（セキュリティ問題あり）

**RLSポリシー：**
```sql
-- stamp_history テーブルに制限なし
CREATE POLICY "誰でも閲覧可能"
ON stamp_history
FOR SELECT
TO authenticated, anon
USING (true);  -- 🔴 常にtrue = 制限なし
```

**クライアントコード（現状）：**
```typescript
// 他人のデータも取得できてしまう 🔴
const { data } = await supabase
  .from("stamp_history")
  .select("*")
  .eq("user_id", "他人のID");  // 🔴 誰のデータでも取得可能
```

---

#### ✅ 方法1：RLSポリシーで制限（推奨）

**RLSポリシー：**
```sql
-- stamp_history テーブルに厳格な制限を設定
CREATE POLICY "自分のデータのみ閲覧可能"
ON stamp_history
FOR SELECT
TO authenticated, anon
USING (
  user_id IN (
    SELECT id FROM profiles WHERE line_user_id = current_setting('request.jwt.claims', true)::json->>'line_user_id'
  )
);
```

**クライアントコード：**
```typescript
// コード変更なし！
// RLSポリシーが自動的に制限してくれる
const { data } = await supabase
  .from("stamp_history")
  .select("*");  // ✅ 自分のデータのみ取得される
```

**メリット：**
- ✅ クライアント側のコード変更不要
- ✅ 既存の機能がそのまま動作
- ✅ データベース側で自動的に制限

**デメリット：**
- ⚠️ LINE認証とSupabase認証の連携が必要
- ⚠️ `current_setting('request.jwt.claims')`の設定が必要

---

#### ✅ 方法2：RPC関数で制限

**1. RPC関数を作成：**
```sql
-- PostgreSQL関数を作成
CREATE OR REPLACE FUNCTION get_my_stamp_history()
RETURNS SETOF stamp_history
LANGUAGE plpgsql
SECURITY DEFINER  -- 管理者権限で実行
AS $$
DECLARE
  current_user_id TEXT;
BEGIN
  -- LINE User IDから現在のユーザーIDを取得
  SELECT id INTO current_user_id
  FROM profiles
  WHERE line_user_id = current_setting('request.jwt.claims', true)::json->>'line_user_id';

  -- 自分のデータのみ返す
  RETURN QUERY
  SELECT * FROM stamp_history
  WHERE user_id = current_user_id;
END;
$$;
```

**2. テーブルへの直接アクセスを禁止：**
```sql
-- stamp_history テーブルへの直接アクセスを全て禁止
DROP POLICY IF EXISTS "誰でも閲覧可能" ON stamp_history;

-- RPC関数経由でのみアクセス可能
```

**3. クライアントコード変更：**
```typescript
// ❌ この方法は使えなくなる
// const { data } = await supabase
//   .from("stamp_history")
//   .select("*");

// ✅ RPC関数経由でアクセス
const { data } = await supabase.rpc("get_my_stamp_history");
```

**メリット：**
- ✅ 完全な制御が可能
- ✅ 複雑なビジネスロジックを実装可能

**デメリット：**
- ❌ クライアント側のコード変更が大量に必要
- ❌ 既存の全てのクエリを書き換える必要がある
- ❌ 開発・テストの工数が大幅に増加

---

## 現在のアプリでの実装方法

### 🔍 現在の問題

現在のアプリは**LINE LIFF認証**を使用していますが、**Supabase Authは使用していません**。

そのため、RLSポリシーで使用する`auth.uid()`が利用できません。

#### 現在の認証フロー

```
ユーザー
  ↓ LINEログイン
LINE LIFF
  ↓ LINE User IDを取得
アプリ（クライアント側）
  ↓ LINE User IDをそのまま使用
Supabase
  ↓ ANON_KEYで接続
  ↓ 🔴 誰のリクエストか判別できない
データベース
```

**問題点：**
- Supabaseは「誰がアクセスしているか」を知らない
- `auth.uid()`が使えない（Supabase Authを使っていないため）
- RLSポリシーで「自分のデータのみ」を判定できない

---

### 💡 解決策の選択肢

#### 選択肢A：Supabase Auth + LINE連携（推奨）

**概要：**
Supabase AuthとLINE LIFFを連携させ、`auth.uid()`を使えるようにする。

**実装手順：**

1. **Supabase Authにカスタムクレームを追加**

```typescript
// hooks/useLiff.ts（既存ファイルを修正）

// LINE LIFFでログイン後
const lineProfile = await liff.getProfile();
const lineUserId = lineProfile.userId;

// Supabaseにカスタムトークンでサインイン
const { data: authData, error } = await supabase.auth.signInWithIdToken({
  provider: 'line',
  token: liff.getAccessToken(),  // LINEアクセストークン
});

// これでauth.uid()が使えるようになる
```

2. **RLSポリシーを設定**

```sql
-- profiles テーブル
CREATE POLICY "自分のプロフィールのみ閲覧可能"
ON profiles
FOR SELECT
TO authenticated, anon
USING (
  id IN (
    SELECT id FROM profiles WHERE line_user_id = auth.jwt()->>'line_user_id'
  )
);

-- stamp_history テーブル
CREATE POLICY "自分のスタンプ履歴のみ閲覧可能"
ON stamp_history
FOR SELECT
TO authenticated, anon
USING (
  user_id IN (
    SELECT id FROM profiles WHERE line_user_id = auth.jwt()->>'line_user_id'
  )
);
```

3. **クライアント側のコード変更は不要！**

既存のコードがそのまま動作します：

```typescript
// これまで通りのコード
const { data } = await supabase
  .from("stamp_history")
  .select("*");

// ✅ RLSポリシーが自動的に制限してくれる
```

**工数：**
- 1-2日（認証フローの修正のみ）
- クライアント側のコード変更：1ファイル（`hooks/useLiff.ts`）
- RLSポリシー追加：各テーブルに設定

**メリット：**
- ✅ クライアント側のコード変更が最小限
- ✅ 既存のクエリがそのまま動作
- ✅ Supabaseの標準機能を使える

---

#### 選択肢B：RPC関数で完全対応

**概要：**
現在の認証方式（LINE LIFF）を変更せず、RPC関数で全てのアクセスを制御。

**実装手順：**

1. **90個以上のRPC関数を作成**

```sql
-- スタンプ履歴取得
CREATE FUNCTION get_my_stamp_history(p_line_user_id TEXT) ...

-- プロフィール取得
CREATE FUNCTION get_my_profile(p_line_user_id TEXT) ...

-- スタンプ追加
CREATE FUNCTION add_stamp(p_line_user_id TEXT, p_amount INT) ...

-- ... 以下、90個以上の関数
```

2. **クライアント側の全てのクエリを書き換え**

```typescript
// ❌ これまでのコード（使えなくなる）
// const { data } = await supabase
//   .from("stamp_history")
//   .select("*");

// ✅ 全てRPC関数に書き換え
const { data } = await supabase.rpc("get_my_stamp_history", {
  p_line_user_id: lineUserId
});
```

**工数：**
- 2週間以上
- クライアント側のコード変更：75+ファイル
- RPC関数作成：90個以上

**デメリット：**
- ❌ 大量のコード変更
- ❌ テストの工数増加
- ❌ 既存機能の動作確認が必要
- ❌ バグのリスク増加

---

#### 選択肢C：最小限のRLSポリシー変更（現在提案中）

**概要：**
DELETE操作のみを制限し、閲覧は制限しない。

**実装手順：**

```sql
-- stamp_history テーブル
CREATE POLICY "削除は禁止"
ON stamp_history
FOR DELETE
TO authenticated, anon
USING (false);  -- 誰も削除できない

-- profiles テーブル
CREATE POLICY "重要データの更新は禁止"
ON profiles
FOR UPDATE
TO authenticated, anon
USING (false)
WITH CHECK (false);
```

**工数：**
- 1日
- コード変更：不要

**メリット：**
- ✅ 最小限の変更
- ✅ 既存コードがそのまま動作

**デメリット：**
- ❌ 閲覧は引き続き可能（データ漏洩リスクは残る）

---

## どちらを選ぶべきか

### 📊 比較表

| 項目 | RLSポリシーのみ（選択肢A） | RPC関数（選択肢B） | 最小限変更（選択肢C） |
|------|---------------------------|-------------------|---------------------|
| **セキュリティレベル** | ⭐⭐⭐⭐⭐ 完全 | ⭐⭐⭐⭐⭐ 完全 | ⭐⭐ 部分的 |
| **工数** | 1-2日 | 2週間以上 | 1日 |
| **コード変更量** | 1ファイル | 75+ファイル | 0ファイル |
| **既存機能への影響** | ✅ ほぼなし | ❌ 全面的に影響 | ✅ なし |
| **メンテナンス性** | ⭐⭐⭐⭐⭐ 良好 | ⭐⭐ やや複雑 | ⭐⭐⭐ 良好 |
| **拡張性** | ⭐⭐⭐⭐⭐ 高い | ⭐⭐⭐ 中程度 | ⭐⭐ 低い |

---

## 推奨アプローチ

### 🎯 推奨：選択肢A（RLSポリシーのみ）

**理由：**

1. **最小限のコード変更で完全なセキュリティを実現**
   - 認証フローの修正のみ（1ファイル）
   - 既存のクエリがそのまま動作

2. **Supabaseの標準機能を活用**
   - `auth.uid()`を使った標準的なRLSポリシー
   - 公式ドキュメントの例が豊富
   - コミュニティのサポートが充実

3. **メンテナンス性が高い**
   - SQLでポリシーを管理
   - クライアント側のコードはシンプル
   - 新しい開発者でも理解しやすい

4. **工数が少ない**
   - 1-2日で実装完了
   - テストの範囲が限定的
   - バグのリスクが低い

---

## 実装例：選択肢A（RLSポリシーのみ）

### ステップ1：認証フローの修正

**現在のコード（hooks/useLiff.ts）：**
```typescript
// LINE LIFFでログイン
const lineProfile = await liff.getProfile();
const lineUserId = lineProfile.userId;

// 🔴 Supabase Authを使っていない
const { data: profile } = await supabase
  .from("profiles")
  .select("*")
  .eq("id", lineUserId)
  .single();
```

**修正後：**
```typescript
// LINE LIFFでログイン
const lineProfile = await liff.getProfile();
const lineUserId = lineProfile.userId;
const lineAccessToken = liff.getAccessToken();

// ✅ Supabaseにカスタムトークンでサインイン
const { data: authData, error: authError } = await supabase.auth.signInWithIdToken({
  provider: 'line',
  token: lineAccessToken,
  options: {
    data: {
      line_user_id: lineUserId,  // カスタムクレームに追加
    }
  }
});

// これで auth.uid() が使えるようになる
const { data: profile } = await supabase
  .from("profiles")
  .select("*")
  .single();  // ✅ RLSポリシーが自動的に自分のデータのみ返す
```

---

### ステップ2：RLSポリシーの設定

#### profiles テーブル

```sql
-- 既存のポリシーを削除
DROP POLICY IF EXISTS "誰でも閲覧可能" ON profiles;

-- SELECT: 自分のプロフィールのみ閲覧可能
CREATE POLICY "自分のプロフィールのみ閲覧可能"
ON profiles
FOR SELECT
TO authenticated, anon
USING (
  line_user_id = auth.jwt()->>'line_user_id'
);

-- UPDATE: 自分のプロフィールのみ更新可能（ただし重要フィールドは除く）
CREATE POLICY "自分のプロフィールのみ更新可能"
ON profiles
FOR UPDATE
TO authenticated, anon
USING (
  line_user_id = auth.jwt()->>'line_user_id'
)
WITH CHECK (
  -- real_name, ticket_number は更新不可
  real_name = (SELECT real_name FROM profiles WHERE id = profiles.id)
  AND ticket_number = (SELECT ticket_number FROM profiles WHERE id = profiles.id)
);

-- DELETE: 誰も削除できない
CREATE POLICY "削除は禁止"
ON profiles
FOR DELETE
TO authenticated, anon
USING (false);
```

#### stamp_history テーブル

```sql
-- 既存のポリシーを削除
DROP POLICY IF EXISTS "誰でも閲覧可能" ON stamp_history;

-- SELECT: 自分のスタンプ履歴のみ閲覧可能
CREATE POLICY "自分のスタンプ履歴のみ閲覧可能"
ON stamp_history
FOR SELECT
TO authenticated, anon
USING (
  user_id IN (
    SELECT id FROM profiles WHERE line_user_id = auth.jwt()->>'line_user_id'
  )
);

-- INSERT: 自分のスタンプ履歴のみ追加可能
CREATE POLICY "自分のスタンプ履歴のみ追加可能"
ON stamp_history
FOR INSERT
TO authenticated, anon
WITH CHECK (
  user_id IN (
    SELECT id FROM profiles WHERE line_user_id = auth.jwt()->>'line_user_id'
  )
);

-- UPDATE: 誰も更新できない
CREATE POLICY "更新は禁止"
ON stamp_history
FOR UPDATE
TO authenticated, anon
USING (false);

-- DELETE: 誰も削除できない
CREATE POLICY "削除は禁止"
ON stamp_history
FOR DELETE
TO authenticated, anon
USING (false);
```

---

### ステップ3：管理操作はSERVICE_ROLE_KEY経由

スタッフ操作（削除、管理者権限での追加など）は、**サーバーサイドのAPI Route**で`SERVICE_ROLE_KEY`を使用：

```typescript
// app/api/staff/delete-stamp/route.ts

import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  // スタッフPIN認証済み

  const supabaseAdmin = getSupabaseAdmin();  // SERVICE_ROLE_KEY

  // ✅ 管理者権限でDELETE可能
  const { error } = await supabaseAdmin
    .from("stamp_history")
    .delete()
    .eq("id", stampId);

  // ...
}
```

---

## まとめ

### ✅ 結論

**RPC関数は必須ではありません。RLSポリシーのみで完全なセキュリティを実現できます。**

### 推奨実装

1. **Supabase Auth + LINE連携**（1-2日）
   - `hooks/useLiff.ts`を修正してSupabase Authを使用
   - カスタムクレームにLINE User IDを追加

2. **RLSポリシーで厳格なアクセス制御**（1日）
   - 各テーブルに適切なポリシーを設定
   - `auth.jwt()->>'line_user_id'`で認証

3. **管理操作はSERVICE_ROLE_KEY**（既存のまま）
   - スタッフ操作は既存のAPI Route経由
   - `getSupabaseAdmin()`を使用

### メリット

- ✅ 工数：2-3日
- ✅ コード変更：1ファイル
- ✅ セキュリティ：完全
- ✅ 既存機能への影響：最小限
- ✅ メンテナンス性：高い

---

## 次のステップ

この実装を進めるべきか、管理ダッシュボード開発者と相談してください。

1. **選択肢A（RLSポリシーのみ）** → 推奨（2-3日）
2. **選択肢B（RPC関数）** → 工数大（2週間）
3. **選択肢C（最小限変更）** → セキュリティ不完全（1日）
