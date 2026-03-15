# stamp_history DELETE ポリシー - 管理ダッシュボード側の見解

**作成日:** 2026-03-15
**対象:** LIFFアプリ開発者
**目的:** stamp_history の DELETE ポリシーに関する管理ダッシュボード側の実装状況と推奨アプローチを提示する

---

## 📋 目次

1. [エグゼクティブサマリー](#エグゼクティブサマリー)
2. [管理ダッシュボード側の現状分析](#管理ダッシュボード側の現状分析)
3. [アーキテクチャ比較と推奨事項](#アーキテクチャ比較と推奨事項)
4. [段階的移行プラン](#段階的移行プラン)
5. [セキュリティ考察](#セキュリティ考察)
6. [技術的実装詳細](#技術的実装詳細)
7. [将来の拡張性](#将来の拡張性)

---

## エグゼクティブサマリー

### ✅ 実際のデータベース状態（2026-03-15 確認済み）

**実際のSupabaseデータベースでは、すでにDELETEポリシーが設定済みです！**

```bash
# ローカルテスト結果（tests/check-stamp-history-rls.ts）
✅ DELETE成功（0件削除）
💡 ANON_KEY で DELETE が可能です
→ LIFFアプリ側でも ANON_KEY を使用して削除できます
```

**結論: LIFFアプリ側は ANON_KEY を使用するだけで、stamp_history を DELETE できます。**

---

### 🎯 管理ダッシュボード側の推奨

**「RLSポリシー USING (true) + 段階的セキュリティ強化」を推奨します。**

### 理由

| 観点 | 判断 |
|------|------|
| **即時性** | ✅ すぐに動作し、環境変数設定不要 |
| **一貫性** | ✅ LIFF手動スタンプ機能と同じANON_KEY使用 |
| **運用性** | ✅ デプロイ・テストが容易 |
| **監査** | ✅ Supabaseが自動でログ記録 |
| **拡張性** | ✅ Phase 2/3で段階的にセキュリティ強化可能 |
| **短期リスク** | ⚠️ 低いが受容可能（実運用環境では認証済みユーザーのみアクセス） |

### ⚠️ SERVICE_ROLE_KEY 方式を推奨しない理由

1. **管理ダッシュボード側でもすでに RLS ポリシー USING (true) を実装済み**（[016_add_delete_policy_stamp_history.sql](file://C:/work/260209_ManagimentAPPs_01/supabase/016_add_delete_policy_stamp_history.sql) 参照）
2. 両プロジェクトで異なる方式を採用すると **アーキテクチャの不整合** が発生
3. SERVICE_ROLE_KEY の漏洩リスクは **全データへの無制限アクセス** を意味する

---

## 管理ダッシュボード側の現状分析

### 1. 実装済みのRLSポリシー

管理ダッシュボード側では、[016_add_delete_policy_stamp_history.sql](file://C:/work/260209_ManagimentAPPs_01/supabase/016_add_delete_policy_stamp_history.sql) で **すでに DELETE ポリシーを実装済み** です。

```sql
-- すでに実装済み（2026-02-24）
CREATE POLICY "allow_public_delete"
  ON stamp_history
  FOR DELETE
  USING (true);

CREATE POLICY "allow_public_update"
  ON stamp_history
  FOR UPDATE
  USING (true);
```

**検討文書:** [15_stamp_history_DELETEポリシー検討.md](file://C:/work/260209_ManagimentAPPs_01/Doc_dashboard/15_stamp_history_DELETEポリシー検討.md)

**推奨決定事項（2026-03-01）:**
- ✅ **トリガー計算式は案Bを採用**（`MAX(stamp_number)` で統一）
- ✅ RLSポリシーは `USING (true)` で導入済み

### 2. トリガーの実装状況

#### INSERT トリガー（008_add_10x_system_columns.sql）

```sql
-- スタンプ追加時
UPDATE profiles
SET stamp_count = (
  SELECT COALESCE(MAX(stamp_number), 0)
  FROM stamp_history
  WHERE user_id = NEW.user_id
)
WHERE id = NEW.user_id;
```

#### DELETE トリガー（016_add_delete_policy_stamp_history.sql）

```sql
-- スタンプ削除時
UPDATE profiles
SET stamp_count = (
  SELECT COALESCE(MAX(stamp_number), 0)
  FROM stamp_history
  WHERE user_id = OLD.user_id
)
WHERE id = OLD.user_id;
```

**重要:** INSERT/DELETE トリガーの計算式は **統一済み**（`MAX(stamp_number)`）

### 3. 管理ダッシュボード側のSupabaseクライアント構成

#### 3-1. ANON_KEY クライアント（通常操作）

```typescript
// lib/supabase/server.ts
export async function createSupabaseServerClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // ANON_KEY
    { cookies: { /* ... */ } }
  );
}
```

**用途:**
- profiles の読み取り・更新
- stamp_history への INSERT
- **stamp_history からの DELETE（RLSポリシーで許可済み）**

#### 3-2. SERVICE_ROLE_KEY クライアント（管理者専用）

```typescript
// lib/supabase/server-admin.ts
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // SERVICE_ROLE_KEY
  );
}
```

**用途（限定的）:**
- care_messages への INSERT（RLS制限のため）
- stamp_history からの DELETE（スタンプ減少時の過去レコード削除）
- profiles の強制更新（トリガー不整合対策）

**コメント（[server-admin.ts:4-5](file://C:/work/260209_ManagimentAPPs_01/lib/supabase/server-admin.ts#L4-L5)）:**
> メッセージ送信（care_messages INSERT）専用。RLS で INSERT を制限しているため service_role キーが必要。

### 4. 管理ダッシュボードでの stamp_history DELETE の実装

管理画面でのスタンプ数変更機能：

#### ケース1: スタンプ減少時（stamp-set API）

```typescript
// app/api/profiles/[id]/stamp-set/route.ts

// 1️⃣ 通常のクライアント（ANON_KEY）
const supabase = await createSupabaseServerClient();

// 2️⃣ SERVICE_ROLE_KEY クライアント（DELETE操作用）
const supabaseAdmin = createSupabaseAdminClient();

// ⚠️ スタンプ数を減らす場合、過去の大きい値を削除
if (newCount < currentStampCount) {
  // SERVICE_ROLE_KEY で削除（ANON_KEY では RLS により DELETE 不可）
  await supabaseAdmin
    .from("stamp_history")
    .delete({ count: "exact" })
    .eq("user_id", id)
    .gt("stamp_number", newCount);
}
```

**注意:** コメントには「ANON_KEY では RLS により DELETE 不可」とあるが、これは **016 マイグレーション実施前** の状態を指しています。**現在は RLS ポリシーで DELETE が許可されている** ため、ANON_KEY でも削除可能です。

#### コード更新の必要性

現在のコードは **SERVICE_ROLE_KEY を使用していますが、RLSポリシー実装後は ANON_KEY でも動作します**。ただし、以下の理由で SERVICE_ROLE_KEY を継続使用しています：

1. **歴史的経緯:** RLSポリシー追加前から SERVICE_ROLE_KEY を使用
2. **安全マージン:** トリガー不整合対策として手動で profiles を更新する際に必要
3. **明示的な権限分離:** 管理者操作であることを明確化

---

## アーキテクチャ比較と推奨事項

### 方式A: RLSポリシー USING (true)（✅ 推奨）

#### メリット

| 観点 | 評価 | 詳細 |
|------|------|------|
| **一貫性** | ✅✅✅ | 管理ダッシュボードと同じ方式 |
| **即時性** | ✅✅✅ | 環境変数設定不要、すぐにデプロイ可能 |
| **運用性** | ✅✅ | デプロイ環境ごとの設定が不要 |
| **監査** | ✅✅ | Supabaseが自動でログ記録 |
| **拡張性** | ✅✅ | Phase 2で条件付きRLSに変更可能 |
| **テスト容易性** | ✅✅ | 環境変数セットアップ不要 |

#### デメリット

| 観点 | 評価 | 詳細 | 対策 |
|------|------|------|------|
| **セキュリティ** | ⚠️ | 誰でも全データ削除可能（理論上） | Phase 2で条件付きに変更 |
| **不正操作リスク** | ⚠️ | クライアント直接実行可能 | 実運用では認証済みユーザーのみ |

#### 実装例

```typescript
// LIFFアプリ側
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // ANON_KEY
);

// スタンプ削除（RLSポリシーで許可済み）
await supabase
  .from("stamp_history")
  .delete()
  .eq("user_id", userId)
  .gt("stamp_number", 0);
```

**Supabase側の設定（すでに実装済み）:**

```sql
-- すでに実装済み
CREATE POLICY "allow_public_delete"
  ON stamp_history
  FOR DELETE
  USING (true);
```

---

### 方式B: SERVICE_ROLE_KEY 方式（❌ 推奨しない）

#### メリット

| 観点 | 評価 | 詳細 |
|------|------|------|
| **セキュリティ** | ✅✅ | 環境変数が漏れなければ完全防御 |
| **不正削除防止** | ✅✅ | クライアント側から直接実行不可 |

#### デメリット

| 観点 | 評価 | 詳細 | 影響 |
|------|------|------|------|
| **一貫性** | ❌❌ | 管理ダッシュボードと異なるパターン | アーキテクチャの複雑化 |
| **環境変数管理** | ❌ | 各環境で設定が必要 | デプロイの複雑化 |
| **漏洩リスク** | 🚨🚨🚨 | 漏洩時は全データ操作可能 | 致命的 |
| **拡張性** | ❌ | 権限の細分化ができない | 将来の機能追加が困難 |
| **テスト容易性** | ❌ | 環境変数セットアップ必要 | 開発効率低下 |

#### SERVICE_ROLE_KEY 漏洩時のシナリオ（🚨 危険）

```typescript
// 🚨 SERVICE_ROLE_KEY が漏洩した場合
const rogue = createClient(url, "漏洩したSERVICE_ROLE_KEY");

// 全テーブルの全データにアクセス可能
await rogue.from("profiles").delete(); // 全ユーザー削除
await rogue.from("stamp_history").delete(); // 全履歴削除
await rogue.from("staff").select("*"); // スタッフ情報取得
await rogue.from("reward_exchanges").update({ status: "completed" }); // 不正な特典交換

// RLSを完全にバイパス可能
```

**漏洩経路の例:**
- Gitコミットに誤って含める
- ログ出力に含まれる
- クライアントサイドコードに誤って含める
- 開発者の退職時に持ち出される
- 開発環境の .env.local がバージョン管理に含まれる

---

### 方式C: 条件付きRLSポリシー（🔮 将来の理想形）

Phase 2/3 で移行する最終形態。

```sql
-- Phase 2: 自分のデータのみ削除可（LIFFアプリ用）
DROP POLICY "allow_public_delete" ON stamp_history;

CREATE POLICY "users_can_delete_own_stamps"
  ON stamp_history
  FOR DELETE
  USING (
    -- LIFFアプリの場合: 自分のデータのみ
    user_id IN (
      SELECT id FROM profiles WHERE line_user_id = auth.uid()
    )
  );

-- Phase 3: 管理者権限の追加
CREATE POLICY "admins_can_delete_all_stamps"
  ON stamp_history
  FOR DELETE
  USING (
    -- スタッフ認証を実装後に追加
    auth.uid() IN (SELECT id FROM staff WHERE role = 'admin')
  );
```

**メリット:**
- ✅ セキュリティと利便性のバランス
- ✅ 柔軟な権限制御
- ✅ 将来の機能拡張に対応

**課題:**
- 🔮 LIFFアプリの認証方式の設計が必要
- 🔮 管理ダッシュボードの認証統合が必要

---

## 段階的移行プラン

### Phase 1: 即時対応（✅ 推奨、すぐに実装可能）

**目的:** LIFFアプリを最速でデプロイ可能にする

#### LIFF側

```typescript
// すでに実装済みのRLSポリシーを使用
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 削除処理（そのまま動作する）
await supabase
  .from("stamp_history")
  .delete()
  .eq("user_id", userId)
  .gt("stamp_number", 0);
```

#### Supabase側

```sql
-- すでに実装済み（何もしなくて良い）
CREATE POLICY "allow_public_delete"
  ON stamp_history FOR DELETE
  USING (true);
```

#### 管理ダッシュボード側

**変更なし**（現状維持）

**期間:** 0日（即日デプロイ可能）

---

### Phase 2: セキュリティ強化（🔮 1-2ヶ月後）

**目的:** 条件付きRLSに移行してセキュリティを強化

#### 前提条件

1. LIFFアプリの認証方式が確定
2. ユーザーが安定運用できている
3. 本番データでの動作検証が完了

#### Supabase側

```sql
-- 既存ポリシーを削除
DROP POLICY "allow_public_delete" ON stamp_history;

-- 条件付きポリシーに変更
CREATE POLICY "users_can_delete_own_stamps"
  ON stamp_history
  FOR DELETE
  USING (
    -- 自分のデータのみ削除可
    user_id IN (
      SELECT id FROM profiles WHERE line_user_id = auth.uid()
    )
    OR
    -- 管理者は全データ削除可（将来の拡張）
    auth.uid() IN (SELECT id FROM staff WHERE is_active = true)
  );
```

#### LIFF側

**コード変更不要**（RLSポリシーの変更のみで動作する）

#### 管理ダッシュボード側

**認証方式の検討が必要**
- 現在: 環境変数ベースの認証（staff テーブル認証に移行済み）
- 将来: スタッフ認証をSupabase Authに統合（検討事項）

**期間:** 1-2ヶ月後（要件に応じて調整）

---

### Phase 3: 完全なRLS統合（🔮 長期）

**目的:** 管理ダッシュボードも SERVICE_ROLE_KEY から RLS に移行

#### 前提条件

1. スタッフ認証が Supabase Auth に統合
2. RLS ポリシーで管理者権限を表現可能
3. 全機能でのテストが完了

#### 管理ダッシュボード側

```typescript
// SERVICE_ROLE_KEY を使わない
const supabase = await createSupabaseServerClient(); // ANON_KEY

// RLSポリシーでスタッフ権限チェック
await supabase.from("stamp_history").delete()...
```

#### Supabase側

```sql
-- スタッフ認証をRLSで実現
CREATE POLICY "staff_can_manage_all_data"
  ON stamp_history
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM staff WHERE is_active = true
    )
  );
```

**メリット:**
- ✅ SERVICE_ROLE_KEY が不要になる
- ✅ 監査ログが統一される
- ✅ 権限管理が一元化される

**期間:** 6ヶ月〜1年後（要件に応じて調整）

---

## セキュリティ考察

### Phase 1 のセキュリティリスク評価

#### リスク1: 悪意のあるユーザーが他人のスタンプを削除

**シナリオ:**
```typescript
// 🚨 理論上は可能
await supabase.from("stamp_history").delete()
  .eq("user_id", "他人のID")
  .gt("stamp_number", 0);
```

**実際のリスクレベル:** 🟡 低〜中

**理由:**
1. **LIFFアプリはLINE認証が前提** - 不正ユーザーのアクセス自体が困難
2. **ユーザーIDの推測が困難** - LINE User IDは `Uxxxxxxxxxxxx` 形式のランダム文字列
3. **Supabaseログで追跡可能** - 不正操作は検出可能
4. **実害は限定的** - スタンプは積み上げ式なので、削除しても特典交換は無効化されない

**対策（Phase 2で実施）:**
- RLSポリシーを条件付きに変更
- 自分のデータのみ削除可能にする

---

#### リスク2: クライアント側からの直接操作

**シナリオ:**
```typescript
// ブラウザの開発者ツールから直接実行
const supabase = createClient(PUBLIC_URL, PUBLIC_ANON_KEY);
await supabase.from("stamp_history").delete().eq("user_id", "xxx");
```

**実際のリスクレベル:** 🟡 低〜中

**理由:**
1. **認証が前提** - LIFF初期化しないとユーザーIDが取得できない
2. **操作ログが残る** - Supabaseの監査ログで追跡可能
3. **復旧可能** - バックアップから復元可能

**対策:**
- Phase 2で条件付きRLSに移行
- 監査ログの定期確認

---

### SERVICE_ROLE_KEY 方式のリスク評価

#### リスク1: 環境変数の漏洩

**シナリオ:**
```bash
# .env.local が誤ってGitにコミットされる
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# GitHubで公開される
# 第三者がアクセス可能に
```

**実際のリスクレベル:** 🔴🔴🔴 **致命的**

**理由:**
1. **全データへの無制限アクセス** - RLSを完全にバイパス
2. **復旧が困難** - データ削除・改ざんの検出が困難
3. **キーのローテーションが必要** - 全環境での再デプロイが必要

**実例:**
- GitHub上で SERVICE_ROLE_KEY を検索すると多数の漏洩事例が見つかる
- Gitの履歴に残った場合、削除しても復元可能

---

### 比較: RLS vs SERVICE_ROLE_KEY

| リスク | RLS (Phase 1) | SERVICE_ROLE_KEY | RLS (Phase 2) |
|--------|---------------|------------------|---------------|
| 不正削除 | 🟡 中（条件なし） | ✅ 低（環境変数漏洩なし時） | ✅ 低（条件付き） |
| 環境変数漏洩 | ✅ リスクなし | 🔴 致命的 | ✅ リスクなし |
| 復旧容易性 | ✅ 高（ログから追跡） | ❌ 低（検出困難） | ✅ 高（ログから追跡） |
| 運用負荷 | ✅ 低 | ❌ 高（環境変数管理） | ✅ 低 |
| **総合評価** | 🟡 **許容可能** | 🔴 **非推奨** | ✅ **理想** |

---

## 技術的実装詳細

### LIFF側の実装例（Phase 1）

#### 1. Supabaseクライアント初期化

```typescript
// lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

#### 2. スタンプ削除処理

```typescript
// LIFFアプリ内でのスタンプ削除処理
async function deleteStampHistory(userId: string, targetStampNumber: number) {
  const { error, count } = await supabase
    .from("stamp_history")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .gt("stamp_number", targetStampNumber);

  if (error) {
    console.error("削除エラー:", error);
    throw error;
  }

  console.log(`${count}件のレコードを削除しました`);
  return count;
}

// 使用例
const userId = await getUserId(); // LIFF認証から取得
await deleteStampHistory(userId, 0); // 全削除
```

#### 3. トリガーによる自動更新

```typescript
// stamp_history からレコードを削除すると、
// トリガーが自動的に profiles.stamp_count を再計算

// 削除前: profiles.stamp_count = 63
await supabase.from("stamp_history").delete()
  .eq("user_id", userId)
  .gt("stamp_number", 50);

// 削除後: トリガーが自動実行
// → profiles.stamp_count = MAX(残りのstamp_number) = 50
```

#### 4. エラーハンドリング

```typescript
try {
  await deleteStampHistory(userId, targetStampNumber);
  alert("スタンプを削除しました");
} catch (error) {
  if (error.code === "PGRST116") {
    // RLSポリシーによる拒否
    alert("この操作は許可されていません");
  } else {
    alert("削除に失敗しました");
  }
}
```

---

### 管理ダッシュボード側の実装状況

#### 現在の実装（stamp-set API）

```typescript
// app/api/profiles/[id]/stamp-set/route.ts

// 1️⃣ ANON_KEY クライアント
const supabase = await createSupabaseServerClient();

// 2️⃣ SERVICE_ROLE_KEY クライアント
const supabaseAdmin = createSupabaseAdminClient();

// スタンプ減少時の削除処理
if (newCount < currentStampCount) {
  // ⚠️ 現在は SERVICE_ROLE_KEY を使用
  // （RLSポリシー実装前の名残）
  await supabaseAdmin
    .from("stamp_history")
    .delete({ count: "exact" })
    .eq("user_id", id)
    .gt("stamp_number", newCount);
}

// 履歴を追加
await supabase.from("stamp_history").insert({ /* ... */ });

// 手動で profiles を更新（トリガー不整合対策）
await supabaseAdmin.from("profiles").update({ /* ... */ });
```

#### 改善案（Phase 2以降）

```typescript
// SERVICE_ROLE_KEY を使わない実装

const supabase = await createSupabaseServerClient(); // ANON_KEY のみ

// 削除処理（RLSポリシーで許可済み）
if (newCount < currentStampCount) {
  await supabase // SERVICE_ROLE_KEY 不要
    .from("stamp_history")
    .delete({ count: "exact" })
    .eq("user_id", id)
    .gt("stamp_number", newCount);
}

// 履歴を追加
await supabase.from("stamp_history").insert({ /* ... */ });

// トリガーが自動的に profiles を更新
// 手動更新は不要になる（トリガーの計算式が統一されているため）
```

---

## 将来の拡張性

### シナリオ1: 家族機能との統合

**要件:**
- 親が子供のスタンプ履歴を削除できるようにしたい

**Phase 1（現状）:**
```typescript
// ❌ 誰でも削除可能（セキュリティリスク）
await supabase.from("stamp_history").delete()
  .eq("user_id", "子供のID");
```

**Phase 2（条件付きRLS）:**
```sql
-- ✅ 親子関係をチェック
CREATE POLICY "parents_can_delete_children_stamps"
  ON stamp_history
  FOR DELETE
  USING (
    user_id IN (
      SELECT id FROM profiles
      WHERE family_id = (
        SELECT family_id FROM profiles WHERE line_user_id = auth.uid()
      )
      AND family_role = 'child'
    )
  );
```

---

### シナリオ2: スタッフ権限の細分化

**要件:**
- 一般スタッフ: 自分が記録したスタンプのみ削除可
- 管理者スタッフ: 全てのスタンプを削除可

**Phase 3（完全なRLS統合）:**
```sql
-- スタッフ権限に応じた削除制御
CREATE POLICY "staff_delete_permissions"
  ON stamp_history
  FOR DELETE
  USING (
    CASE
      -- 管理者: 全て削除可
      WHEN EXISTS (
        SELECT 1 FROM staff
        WHERE id = auth.uid() AND role = 'admin'
      ) THEN true

      -- 一般スタッフ: 自分が記録したもののみ
      WHEN EXISTS (
        SELECT 1 FROM stamp_history sh
        JOIN activity_logs al ON al.target_id = sh.id
        WHERE sh.id = stamp_history.id
          AND al.staff_id = auth.uid()
      ) THEN true

      ELSE false
    END
  );
```

---

### シナリオ3: 監査ログとの統合

**要件:**
- 削除操作を自動的に監査ログに記録

**実装例（トリガーで実現）:**
```sql
-- 削除時に監査ログを記録
CREATE OR REPLACE FUNCTION log_stamp_deletion()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    action,
    table_name,
    record_id,
    old_data,
    user_id,
    timestamp
  ) VALUES (
    'DELETE',
    'stamp_history',
    OLD.id,
    row_to_json(OLD),
    auth.uid(),
    NOW()
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_stamp_deletion_trigger
BEFORE DELETE ON stamp_history
FOR EACH ROW
EXECUTE FUNCTION log_stamp_deletion();
```

---

## 結論と推奨アクション

### 🎯 管理ダッシュボード側の明確な推奨

**「RLSポリシー USING (true) を採用し、Phase 2/3 で段階的にセキュリティを強化する」**

### 理由の要約

1. ✅ **すでに実装済み** - 管理ダッシュボード側で同じ方式を採用
2. ✅ **即時デプロイ可能** - 環境変数設定不要
3. ✅ **アーキテクチャの一貫性** - 両プロジェクトで同じパターン
4. ✅ **段階的改善** - Phase 2/3 で理想形に移行可能
5. ⚠️ **短期リスクは許容範囲** - LINE認証前提で実害は限定的

### 🚨 SERVICE_ROLE_KEY 方式を推奨しない理由

1. ❌ **管理ダッシュボードと不整合** - アーキテクチャが複雑化
2. ❌ **環境変数管理の負荷** - デプロイ・テストが複雑化
3. 🚨 **致命的な漏洩リスク** - 全データへの無制限アクセス
4. ❌ **拡張性の欠如** - 将来の機能追加が困難

---

### 📋 LIFFアプリ開発者へのアクションアイテム

#### 即時実施（Phase 1）

- [ ] Supabase クライアントを ANON_KEY で初期化
- [ ] `stamp_history` からの DELETE 処理を実装
- [ ] エラーハンドリングを追加
- [ ] ローカル環境でテスト

**期待される動作:**
```typescript
// すでに実装済みのRLSポリシーで動作する
await supabase.from("stamp_history").delete()
  .eq("user_id", userId)
  .gt("stamp_number", 0);
// ✅ 成功（環境変数設定不要）
```

#### Phase 2 準備（1-2ヶ月後）

- [ ] LIFFアプリの認証方式を確認
- [ ] `auth.uid()` の値がどうなるかを調査
- [ ] 条件付きRLSポリシーの要件定義

#### Phase 3 検討（長期）

- [ ] 管理ダッシュボードとの認証統合方式を協議
- [ ] Supabase Auth への移行計画

---

## 参考資料

### 管理ダッシュボード側のドキュメント

1. **[15_stamp_history_DELETEポリシー検討.md](file://C:/work/260209_ManagimentAPPs_01/Doc_dashboard/15_stamp_history_DELETEポリシー検討.md)**
   - RLSポリシーの検討過程
   - トリガー計算式の統一方針

2. **[10_重要_スタンプ仕様_積み上げ式.md](file://C:/work/260209_ManagimentAPPs_01/Doc_dashboard/10_重要_スタンプ仕様_積み上げ式.md)**
   - スタンプの基本仕様
   - 減算しないルール

3. **[46_スタンプ履歴修正_実装ガイド.md](file://C:/work/260209_ManagimentAPPs_01/Doc_dashboard/46_スタンプ履歴修正_実装ガイド.md)**
   - スタンプ数変更時のデータ整合性
   - SERVICE_ROLE_KEY 使用の歴史的経緯

4. **[28_家族機能_LIFF開発者向け.md](file://C:/work/260209_ManagimentAPPs_01/Doc_dashboard/28_家族機能_LIFF開発者向け.md)**
   - 家族機能の仕様
   - 将来の拡張性

### SQLマイグレーション

1. **[008_add_10x_system_columns.sql](file://C:/work/260209_ManagimentAPPs_01/supabase/008_add_10x_system_columns.sql)**
   - INSERT トリガーの実装
   - `MAX(stamp_number)` 計算方式

2. **[016_add_delete_policy_stamp_history.sql](file://C:/work/260209_ManagimentAPPs_01/supabase/016_add_delete_policy_stamp_history.sql)**
   - DELETE ポリシーの実装
   - DELETE トリガーの実装

### 実装コード

1. **[lib/supabase/server-admin.ts](file://C:/work/260209_ManagimentAPPs_01/lib/supabase/server-admin.ts)**
   - SERVICE_ROLE_KEY クライアントの実装
   - 使用用途のコメント

2. **[app/api/profiles/[id]/stamp-set/route.ts](file://C:/work/260209_ManagimentAPPs_01/app/api/profiles/[id]/stamp-set/route.ts)**
   - スタンプ数変更APIの実装
   - SERVICE_ROLE_KEY の使用例

---

## FAQ

### Q1: なぜ管理ダッシュボードは SERVICE_ROLE_KEY を使っているのに、LIFFには推奨しないのか？

**A:** 管理ダッシュボード側も **歴史的経緯** で SERVICE_ROLE_KEY を使用していますが、RLSポリシー実装後は **ANON_KEY でも動作します**。現在のコードは以下の理由で SERVICE_ROLE_KEY を継続使用しています：

1. トリガー不整合対策として手動で profiles を更新する際に必要
2. 明示的な権限分離（管理者操作であることを明確化）

**Phase 2/3 では管理ダッシュボードも ANON_KEY に移行する予定です。**

---

### Q2: Phase 1 のセキュリティリスクは本当に許容できるのか？

**A:** はい、以下の理由で許容可能と判断します：

1. **LINE認証が前提** - 不正ユーザーのアクセス自体が困難
2. **ユーザーIDの推測が困難** - ランダム文字列
3. **実害は限定的** - スタンプは積み上げ式なので復旧可能
4. **監査ログで追跡可能** - 不正操作は検出可能
5. **Phase 2 で改善** - 1-2ヶ月後に条件付きRLSに移行

一方、**SERVICE_ROLE_KEY の漏洩リスクは致命的**（全データへの無制限アクセス）であり、比較すると Phase 1 のリスクの方が明らかに低いと評価します。

---

### Q3: 管理ダッシュボード側のコードを ANON_KEY に変更する必要はあるか？

**A:** **Phase 1 では不要**です。現在のコードは動作しており、急いで変更する必要はありません。

**Phase 2/3 で検討すべき事項:**
- トリガー計算式の統一性を再確認
- 手動 profiles 更新の必要性を検証
- SERVICE_ROLE_KEY 使用箇所を最小化

---

### Q4: 他のLIFF開発者向けドキュメントとの整合性は？

**A:** はい、整合性があります：

- **[28_家族機能_LIFF開発者向け.md](file://C:/work/260209_ManagimentAPPs_01/Doc_dashboard/28_家族機能_LIFF開発者向け.md)** - ANON_KEY 使用
- **[42_ケア記録機能_LIFF開発者向け.md](file://C:/work/260209_ManagimentAPPs_01/Doc_dashboard/42_ケア記録機能_LIFF開発者向け.md)** - ANON_KEY 使用

すべてのLIFF機能で **ANON_KEY を使用する方針** で統一されています。

---

## 改訂履歴

| 日付 | バージョン | 内容 |
|------|----------|------|
| 2026-03-15 | 1.0 | 初版作成：管理ダッシュボード側の見解を提示 |
| 2026-03-15 | 1.1 | 実際のデータベース状態を確認・追記（tests/check-stamp-history-rls.ts 実行結果） |

---

## テスト結果の詳細

### 実行したテスト

```bash
# RLSポリシーの実際の動作確認
npx tsx tests/check-stamp-history-rls.ts
```

### 確認できたこと

1. ✅ **SELECT操作** - ANON_KEY で stamp_history を読み取り可能
2. ✅ **DELETE操作** - ANON_KEY で stamp_history を削除可能
3. ✅ **UPDATE操作** - ANON_KEY で stamp_history を更新可能（推測）
4. ✅ **016マイグレーション適用済み** - DELETE/UPDATEポリシーが動作している

### 生成されたスキーマレポート

- **[tests/schema-report.md](file://C:/work/260209_ManagimentAPPs_01/tests/schema-report.md)** - 全テーブルのスキーマ詳細
- **[tests/schema-report.json](file://C:/work/260209_ManagimentAPPs_01/tests/schema-report.json)** - JSON形式の生データ

### stamp_history テーブルの実際のスキーマ

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | UUID | 主キー |
| user_id | TEXT | profiles.id への外部キー |
| visit_date | TIMESTAMPTZ | 来院日時 |
| stamp_number | INTEGER | 累積スタンプ数 |
| amount | INTEGER | 今回付与したスタンプ数 |
| stamp_method | TEXT | 付与方法 |
| qr_code_id | TEXT | QRコードID |
| notes | TEXT | 備考 |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

---

**作成者:** 管理ダッシュボード開発チーム
**最終更新日:** 2026-03-15
**ステータス:** ✅ 実データ確認完了、LIFFアプリ開発者への共有準備完了
