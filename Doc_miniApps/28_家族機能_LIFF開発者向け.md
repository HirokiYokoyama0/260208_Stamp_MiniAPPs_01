# 家族ひもづけ機能 - LIFF開発者向け実装ガイド

**作成日:** 2026-03-15
**対象:** LINEミニアプリ（LIFF）開発者
**前提:** 管理ダッシュボード側は実装完了（Phase 1-2）

---

## 📋 目次

1. [概要](#概要)
2. [データベース構造](#データベース構造)
3. [Phase 3: LIFF側の表示実装](#phase-3-liff側の表示実装)
4. [Phase 4: 特典交換の拡張](#phase-4-特典交換の拡張)
5. [API仕様](#api仕様)
6. [実装例](#実装例)
7. [注意事項](#注意事項)

---

## 概要

### 実現する機能

現在の「1つのLINEアカウント = 1枚の診察券 = 1つのスタンプ数」という1:1構造を、**家族単位でスタンプを共有できる仕組み**に拡張します。

### ユースケース

| ケース | 現状 | 実装後 |
|-------|------|--------|
| **母親が子供を連れて来院** | 母親+1個、子供+1個（別々） | 家族の合計+2個（共有財布） |
| **父親が定期検診** | 父親+1個 | 家族の合計+1個（同じ財布） |
| **特典交換** | 母親が10個貯めて交換 | 家族で10個貯めたら誰でも交換可能 |

### 管理ダッシュボード側の実装状況 ✅

- ✅ `families` テーブル作成済み
- ✅ `profiles` に `family_id`, `family_role` カラム追加済み
- ✅ 全ユーザーに単身家族を自動作成済み
- ✅ 家族作成・編集・解散機能実装済み
- ✅ `family_stamp_totals` ビュー作成済み

---

## データベース構造

### 1. families テーブル

世帯（お財布）の実体。

```sql
CREATE TABLE families (
  id TEXT PRIMARY KEY,
  family_name TEXT NOT NULL,
  representative_user_id TEXT REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | TEXT | 家族ID（主キー） |
| family_name | TEXT | 「○○家」などの表示用名称 |
| representative_user_id | TEXT (FK) | 代表者のprofiles.id |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

---

### 2. profiles テーブル（拡張）

個人（LINEユーザー）のデータ。

```sql
ALTER TABLE profiles
  ADD COLUMN family_id TEXT REFERENCES families(id),
  ADD COLUMN family_role TEXT DEFAULT 'child'
    CHECK (family_role IN ('parent', 'child'));
```

| カラム名 | 型 | 説明 |
|---------|---|------|
| family_id | TEXT (FK) | 所属する families.id への参照 |
| family_role | TEXT | 'parent' (保護者) / 'child' (子ども) |
| **stamp_count** | INTEGER | 個人の累積スタンプ数（既存カラム） |
| **visit_count** | INTEGER | 個人の純粋な来院回数（既存カラム） |

**重要:**
- **全ユーザーは必ず何らかの家族に所属**（単身者も1人家族として扱う）
- `stamp_count` は個人のスタンプ数（変更なし）
- 家族の合計は `family_stamp_totals` ビューで計算

---

### 3. family_stamp_totals ビュー

家族の合計スタンプ数を計算。

```sql
CREATE VIEW family_stamp_totals AS
SELECT
  f.id AS family_id,
  f.family_name,
  f.representative_user_id,
  SUM(p.stamp_count) AS total_stamp_count,
  SUM(p.visit_count) AS total_visit_count,
  COUNT(p.id) AS member_count,
  MAX(p.last_visit_date) AS last_family_visit,
  MAX(p.updated_at) AS last_family_login
FROM families f
LEFT JOIN profiles p ON p.family_id = f.id
GROUP BY f.id, f.family_name, f.representative_user_id;
```

| カラム名 | 型 | 説明 |
|---------|---|------|
| family_id | TEXT | 家族ID |
| family_name | TEXT | 家族名 |
| total_stamp_count | INTEGER | 家族全体の合計スタンプ数 |
| total_visit_count | INTEGER | 家族全体の合計来院回数 |
| member_count | INTEGER | 家族のメンバー数 |

---

### 4. 区分の判定ロジック

**表示区分:**
1. **保護者** - `family_role = 'parent'` かつ `line_user_id` 存在
2. **子（スマホあり）** - `family_role = 'child'` かつ `line_user_id` 存在
3. **子（スマホなし）** - `family_role = 'child'` かつ `line_user_id` NULL
4. **なし** - 1人家族の場合（`member_count = 1`）

---

## Phase 3: LIFF側の表示実装

### 実装する機能

1. 個人のスタンプ数と家族全体のスタンプ数を併記
2. 家族メンバー一覧の表示
3. 特典交換時の選択（個人/家族スタンプ）

---

### 3-1. データ取得

**必要なデータ:**
- ログインユーザーの `profile` 情報
- 家族情報（`family_stamp_totals` ビューから取得）
- 家族メンバー一覧（`profiles` テーブルから取得）

**取得例（Supabase）:**

```typescript
// 1. 自分のプロフィール取得
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('line_user_id', lineUserId)
  .single();

// 2. 家族情報取得（family_stamp_totals ビューから）
const { data: family } = await supabase
  .from('family_stamp_totals')
  .select('*')
  .eq('family_id', profile.family_id)
  .single();

// 3. 家族メンバー一覧取得
const { data: members } = await supabase
  .from('profiles')
  .select('id, display_name, stamp_count, visit_count, family_role')
  .eq('family_id', profile.family_id)
  .order('family_role', { ascending: false }); // parent が先
```

---

### 3-2. UI表示例

#### 2人以上の家族の場合

```
┌─────────────────────────────────────┐
│ 🏠 横山家                            │
│ 家族全体: 23個 🎖                    │
│ あなた: 12個                         │
├─────────────────────────────────────┤
│ 👨 横山太郎（あなた） 12個            │
│ 👩 横山花子 8個                      │
│ 👦 横山一郎 3個                      │
└─────────────────────────────────────┘

💫 交換可能: 2回（家族スタンプを使用中）

[特典を交換する]
```

#### 単身者の場合

```
┌─────────────────────────────────────┐
│ マイスタンプカード                    │
├─────────────────────────────────────┤
│ 🎯 あなたのスタンプ: 12個             │
│                                      │
│ 💫 交換可能: 1回                     │
│                                      │
│ [特典を交換する]                     │
└─────────────────────────────────────┘
```

---

### 3-3. 実装コード例

```typescript
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

type Profile = {
  id: string;
  display_name: string | null;
  stamp_count: number;
  visit_count: number;
  family_id: string | null;
  family_role: 'parent' | 'child' | null;
  line_user_id: string;
};

type FamilyStampTotal = {
  family_id: string;
  family_name: string;
  total_stamp_count: number;
  total_visit_count: number;
  member_count: number;
};

export function StampCard({ lineUserId }: { lineUserId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [family, setFamily] = useState<FamilyStampTotal | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // 1. プロフィール取得
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('line_user_id', lineUserId)
        .single();

      setProfile(profileData);

      if (!profileData?.family_id) return;

      // 2. 家族情報取得
      const { data: familyData } = await supabase
        .from('family_stamp_totals')
        .select('*')
        .eq('family_id', profileData.family_id)
        .single();

      setFamily(familyData);

      // 3. メンバー一覧取得
      const { data: membersData } = await supabase
        .from('profiles')
        .select('id, display_name, stamp_count, visit_count, family_role')
        .eq('family_id', profileData.family_id)
        .order('family_role', { ascending: false });

      setMembers(membersData || []);
    };

    fetchData();
  }, [lineUserId]);

  if (!profile || !family) {
    return <div>読み込み中...</div>;
  }

  // 家族が2人以上か確認
  const isFamily = family.member_count >= 2;

  // 交換可能回数の計算（後述）
  const exchangeableCount = calculateExchangeableCount(
    isFamily ? family.total_stamp_count : profile.stamp_count
  );

  return (
    <div className="p-4 border rounded-lg">
      {isFamily ? (
        <>
          <h2 className="text-lg font-bold">🏠 {family.family_name}</h2>
          <p className="text-2xl font-bold">
            家族全体: {family.total_stamp_count}個 🎖
          </p>
          <p className="text-sm text-gray-600">
            あなた: {profile.stamp_count}個
          </p>

          <div className="mt-4">
            <h3 className="font-semibold mb-2">メンバー</h3>
            {members.map((member) => (
              <div key={member.id} className="flex justify-between py-1">
                <span>
                  {member.family_role === 'parent' ? '👨' : '👦'}{' '}
                  {member.display_name}
                  {member.id === profile.id && '（あなた）'}
                </span>
                <span>{member.stamp_count}個</span>
              </div>
            ))}
          </div>

          <p className="mt-4 text-sm text-gray-600">
            💫 交換可能: {exchangeableCount}回（家族スタンプを使用中）
          </p>
        </>
      ) : (
        <>
          <h2 className="text-lg font-bold">マイスタンプカード</h2>
          <p className="text-2xl font-bold">
            🎯 あなたのスタンプ: {profile.stamp_count}個
          </p>
          <p className="mt-4 text-sm text-gray-600">
            💫 交換可能: {exchangeableCount}回
          </p>
        </>
      )}

      <button className="mt-4 w-full bg-blue-500 text-white py-2 rounded">
        特典を交換する
      </button>
    </div>
  );
}

// 交換可能回数の計算（簡易版）
function calculateExchangeableCount(stampCount: number): number {
  const REQUIRED_STAMPS = 10; // 1回の交換に必要なスタンプ数
  return Math.floor(stampCount / REQUIRED_STAMPS);
}
```

---

## Phase 4: 特典交換の拡張

### 実装する機能

1. 家族スタンプを使った特典交換
2. 交換履歴の記録（既存の `reward_exchanges` テーブルで対応可能）

---

### 4-1. スタンプ計算ロジック

**基本方針:**
- スタンプは**累積のみ**（減算なし）
- 交換履歴は別途管理
- 家族所属かつ2人以上の場合は自動的に家族スタンプを使用

**計算ロジック:**

```typescript
// 使用する累積スタンプ数の判定
let effectiveStampCount: number;

if (profile.family_id && family.member_count >= 2) {
  // 2人以上の家族の場合は家族スタンプを使用
  effectiveStampCount = family.total_stamp_count;
} else {
  // 単身者は個人スタンプを使用
  effectiveStampCount = profile.stamp_count;
}

// 交換可能回数の計算
const REQUIRED_STAMPS = 10; // 1回の交換に必要なスタンプ数
const maxExchanges = Math.floor(effectiveStampCount / REQUIRED_STAMPS);

// 交換済み回数を取得
const { count: completedExchanges } = await supabase
  .from('reward_exchanges')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', profile.id)
  .eq('reward_id', rewardId)
  .eq('status', 'completed');

// 残り交換可能回数
const remainingExchanges = maxExchanges - (completedExchanges || 0);
```

---

### 4-2. 特典交換履歴の記録

⚠️ **重要: カラム追加は不要です**

既存の `reward_exchanges` テーブルで全ての要件を満たせます。以下の情報は既存カラムまたは参照で取得可能です:

| 必要な情報 | 取得方法 | 追加カラム不要 |
|-----------|---------|---------------|
| 交換時の家族ID | `user_id` → `profiles.family_id` で参照 | ✅ |
| 個人/家族の判定 | `profiles.family_id IS NOT NULL` で自明 | ✅ |
| 交換時のスタンプ数 | スタンプは減らないため記録不要 | ✅ |

**理由:**

1. **家族ID (`family_id`)** - `user_id` から `profiles.family_id` を参照すれば取得可能
2. **スタンプ種別 (`stamp_source`)** - `profiles.family_id` の有無で自明に判定可能
3. **交換時スタンプ数 (`stamp_count_at_exchange`)** - スタンプは減らないため記録する意味がない

**データ取得例:**

```sql
-- 交換履歴から家族情報を取得
SELECT
  re.*,
  p.family_id,  -- user_id から profiles.family_id を参照
  CASE
    WHEN p.family_id IS NOT NULL THEN 'family'
    ELSE 'individual'
  END as stamp_source  -- 自動判定
FROM reward_exchanges re
JOIN profiles p ON p.id = re.user_id;
```

---

### 4-3. 特典交換の実装例

```typescript
async function exchangeReward(
  profile: Profile,
  family: FamilyStampTotal | null,
  rewardId: string
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 1. 使用スタンプ数を判定
  const isFamily = family && family.member_count >= 2;
  const effectiveStampCount = isFamily
    ? family.total_stamp_count
    : profile.stamp_count;

  // 2. 交換可能か確認
  const REQUIRED_STAMPS = 10;
  const maxExchanges = Math.floor(effectiveStampCount / REQUIRED_STAMPS);

  const { count: completedExchanges } = await supabase
    .from('reward_exchanges')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('reward_id', rewardId)
    .eq('status', 'completed');

  if (maxExchanges <= (completedExchanges || 0)) {
    return { success: false, error: 'スタンプが不足しています' };
  }

  // 3. 交換履歴に記録（既存カラムのみ使用）
  const { error } = await supabase.from('reward_exchanges').insert({
    user_id: profile.id,
    reward_id: rewardId,
    stamp_count_used: REQUIRED_STAMPS,
    status: 'pending',
    exchanged_at: new Date().toISOString(),
  });

  if (error) {
    console.error('交換履歴の記録に失敗:', error);
    return { success: false, error };
  }

  return { success: true };
}
```

**ポイント:**
- 既存の `reward_exchanges` テーブルにそのまま記録
- `family_id`, `stamp_source`, `stamp_count_at_exchange` は記録しない
- 必要な情報は `user_id` → `profiles` の参照で取得可能

---

## API仕様

### 必要なエンドポイント

LIFFアプリから使用するAPIエンドポイント（既存のSupabase RLSポリシーで対応可能）

| エンドポイント | 説明 | 使用方法 |
|--------------|------|---------|
| `profiles` テーブル | 自分のプロフィール取得 | `.eq('line_user_id', lineUserId)` |
| `family_stamp_totals` ビュー | 家族情報取得 | `.eq('family_id', profile.family_id)` |
| `profiles` テーブル | 家族メンバー一覧 | `.eq('family_id', profile.family_id)` |
| `reward_exchanges` テーブル | 交換履歴記録 | `.insert()` |

---

## 実装例

### データ取得の完全な例

```typescript
import { createClient } from '@supabase/supabase-js';

export async function getFamilyData(lineUserId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 1. プロフィール取得
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('line_user_id', lineUserId)
    .single();

  if (profileError || !profile) {
    throw new Error('プロフィールの取得に失敗しました');
  }

  // 2. 家族情報取得
  const { data: family, error: familyError } = await supabase
    .from('family_stamp_totals')
    .select('*')
    .eq('family_id', profile.family_id)
    .single();

  if (familyError) {
    console.warn('家族情報の取得に失敗:', familyError);
  }

  // 3. 家族メンバー取得
  const { data: members, error: membersError } = await supabase
    .from('profiles')
    .select('id, display_name, stamp_count, visit_count, family_role, line_user_id')
    .eq('family_id', profile.family_id)
    .order('family_role', { ascending: false }); // parent が先

  if (membersError) {
    console.warn('メンバー一覧の取得に失敗:', membersError);
  }

  // 4. 交換可能回数の計算
  const isFamily = family && family.member_count >= 2;
  const stampCount = isFamily ? family.total_stamp_count : profile.stamp_count;

  // 5. 交換済み回数を取得
  const { count: exchangedCount } = await supabase
    .from('reward_exchanges')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .or(
      isFamily
        ? `family_id.eq.${profile.family_id}`
        : `family_id.is.null,stamp_source.eq.individual`
    );

  const REQUIRED_STAMPS = 10;
  const exchangeableCount = Math.floor(stampCount / REQUIRED_STAMPS) - (exchangedCount || 0);

  return {
    profile,
    family,
    members: members || [],
    isFamily,
    stampCount,
    exchangeableCount,
  };
}
```

---

## 注意事項

### 1. データ整合性

- **家族情報は管理ダッシュボード側で管理**
- LIFF側では**参照のみ**（編集はしない）
- `family_id` の変更は管理者が行う

### 2. パフォーマンス

- `family_stamp_totals` はビューなので、計算コストがかかる
- キャッシュを活用する（SWR、React Queryなど）
- 頻繁に再取得しない

### 3. エラーハンドリング

- 家族情報が取得できない場合は単身者として扱う
- メンバー一覧が空の場合は自分だけ表示

### 4. スマホなし子どもの扱い

- `line_user_id` が NULL のユーザーはLIFFにログインできない
- 親が代理で登録した子ども（スマホなし）の場合
- 家族メンバー一覧には表示するが、ログインはできない

---

## まとめ

### 実装の流れ

1. **Phase 3（表示）** - 1-2日
   - 家族情報の取得
   - UI表示の実装
   - メンバー一覧の表示

2. **Phase 4（交換）** - 2-3日
   - スタンプ計算ロジックの実装
   - 交換履歴の記録
   - `reward_exchanges` テーブルの拡張

### 参考ドキュメント

- **[27_家族ひもづけ機能_管理ダッシュボード仕様書.md](27_家族ひもづけ機能_管理ダッシュボード仕様書.md)** - 管理側の詳細仕様
- **[05_Database_Schema.md](05_Database_Schema.md)** - データベース全体の構造
- **[lib/types.ts](../lib/types.ts)** - TypeScript型定義

---

**作成者:** Claude Code
**最終更新日:** 2026-03-15
**ステータス:** ✅ 準備完了（管理側実装完了、LIFF側実装待ち）
