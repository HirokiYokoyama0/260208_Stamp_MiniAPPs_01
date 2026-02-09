# スタンプシステム設計書

## 📋 基本仕様

### スタンプ付与ルール
- **1回の来院 = 1個のスタンプ**（基本ルール）
- 将来的に診療内容によって変更可能（現在は常に1個）

### スタッフ編集機能
- **目的**: 誤登録の修正、テスト用途
- **制限**: なし（何度でも編集可能）
- **監査証跡**: すべての編集履歴を `stamp_history` に記録

---

## 🗄️ データベース設計

### stamp_historyテーブル

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | UUID | 主キー |
| user_id | TEXT | ユーザーID（profiles.id） |
| visit_date | TIMESTAMPTZ | 来院日時 |
| **stamp_number** | **INTEGER** | **その時点でのスタンプ数（累積）** |
| stamp_method | TEXT | 登録方法（'qr_scan' or 'manual_admin'） |
| qr_code_id | TEXT | QRコードID |
| notes | TEXT | メモ |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

#### stamp_numberの意味

**重要**: `stamp_number` は「その時点でのスタンプ数（累積）」を表します。

**例**:
```
| visit_date | stamp_number | stamp_method | 説明 |
|-----------|--------------|--------------|------|
| 2月8日 09:00 | 1 | qr_scan | 1回目の来院 → スタンプ1個 |
| 2月9日 10:00 | 2 | qr_scan | 2回目の来院 → スタンプ2個 |
| 2月9日 10:30 | 5 | manual_admin | スタッフが「5個に設定」 |
| 2月9日 11:00 | 4 | manual_admin | スタッフが「4個に修正」 |
```

#### 訪問回数とスタンプ数の区別

- **訪問回数** = `stamp_history` テーブルのレコード数
- **スタンプ数** = `MAX(stamp_number)`

---

## 🔄 トリガー関数

### update_profile_stamp_count()

スタンプ履歴が追加されたら、`profiles.stamp_count` を自動更新します。

```sql
CREATE OR REPLACE FUNCTION update_profile_stamp_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET
    stamp_count = (
      SELECT COALESCE(MAX(stamp_number), 0)  -- 最大値を取得
      FROM stamp_history
      WHERE user_id = NEW.user_id
    ),
    last_visit_date = (
      SELECT MAX(visit_date)
      FROM stamp_history
      WHERE user_id = NEW.user_id
    ),
    updated_at = NOW()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**なぜ `MAX(stamp_number)` を使うのか？**

- スタッフ編集でスタンプ数を自由に設定できるようにするため
- 例: スタッフが「5個に設定」→ `stamp_number = 5` → `profiles.stamp_count = 5`

**なぜ `COUNT(*)` ではダメなのか？**

- `COUNT(*)` はレコード数（訪問回数）をカウントする
- スタッフ編集でスタンプ数を変更しても、レコード数は変わらない
- 例: スタッフが「5個に設定」→ レコード数 = 1 → `profiles.stamp_count = 1` ❌

---

## 📱 画面表示

### スタンプページ（/stamp）

#### スタンプカウンター
- **現在のスタンプ数**: `profiles.stamp_count` を表示
- **訪問回数**: `stamp_history` のレコード数を表示

```tsx
<h2>現在のスタンプ数</h2>
<p className="訪問回数">訪問回数: {stampHistory.length}回</p>
<p className="スタンプ数">{stampCount}個</p>
```

#### 来院履歴リスト
- **訪問回数**: 配列のインデックスから計算（最新が1番目）
- **スタンプ数**: `record.stamp_number` を表示
- **スタッフ編集**: `stamp_method === 'manual_admin'` の場合に表示

```tsx
{stampHistory.map((record, index) => {
  const visitNumber = stampHistory.length - index; // 訪問回数
  return (
    <li>
      <p>{visitNumber}回目の来院 {isManualEdit && "(スタッフ編集)"}</p>
      <p>{formatStampDate(record.visit_date)} • スタンプ {record.stamp_number}個</p>
    </li>
  );
})}
```

---

## 🔧 API仕様

### POST /api/stamps（QRスキャン）

**動作**:
1. 現在のスタンプ数を取得（`profiles.stamp_count`）
2. 次のスタンプ数を計算（`currentStampCount + 1`）
3. `stamp_history` に新規レコードを挿入（`stamp_number = currentStampCount + 1`）
4. トリガーで `profiles.stamp_count` が自動更新される

**コード** (`app/api/stamps/route.ts` 100行目):
```typescript
const currentStampCount = profileData?.stamp_count ?? 0;
const nextStampNumber = currentStampCount + 1;

await supabase.from("stamp_history").insert({
  user_id: userId,
  stamp_number: nextStampNumber,  // 現在のスタンプ数 + 1
  stamp_method: "qr_scan",
});
```

### POST /api/stamps/manual（スタッフ編集）

**動作**:
1. スタッフが新しいスタンプ数を指定（例: 5個）
2. `profiles.stamp_count` を直接更新
3. `stamp_history` に監査証跡を記録（`stamp_number = newStampCount`）
4. トリガーで `profiles.stamp_count` が再計算される（`MAX(stamp_number)`）

**コード** (`app/api/stamps/manual/route.ts` 131行目):
```typescript
await supabase.from("profiles").update({ stamp_count: newStampCount });

await supabase.from("stamp_history").insert({
  user_id: userId,
  stamp_number: newStampCount,  // スタッフが指定した値
  stamp_method: "manual_admin",
});
```

---

## 🔍 トラブルシューティング

### Q1: スタンプ数が正しく表示されない

**A**: トリガー関数が `MAX(stamp_number)` を使っているか確認してください。

```sql
-- 確認
SELECT proname, prosrc FROM pg_proc WHERE proname = 'update_profile_stamp_count';

-- 修正（上記のトリガー関数を実行）
CREATE OR REPLACE FUNCTION update_profile_stamp_count() ...
```

### Q2: 既存データが正しくない

**A**: 以下のSQLで再計算してください。

```sql
UPDATE profiles
SET stamp_count = (
  SELECT COALESCE(MAX(stamp_number), 0)
  FROM stamp_history
  WHERE user_id = profiles.id
);
```

### Q3: 訪問回数とスタンプ数がごっちゃになっている

**A**: 以下を確認してください：
- 訪問回数 = レコード数 = `stamp_history.length`
- スタンプ数 = `MAX(stamp_number)` = `profiles.stamp_count`

---

## 📊 データ例

### 正しい例

```sql
-- profiles
id | stamp_count
---|------------
U1 | 5

-- stamp_history
id | user_id | visit_date | stamp_number | stamp_method
---|---------|------------|--------------|-------------
1  | U1      | 2月8日 09:00 | 1            | qr_scan
2  | U1      | 2月9日 10:00 | 2            | qr_scan
3  | U1      | 2月9日 10:30 | 5            | manual_admin

-- 結果
訪問回数: 3回（レコード数）
スタンプ数: 5個（MAX(stamp_number)）
```

### 誤った例（COUNT(*)を使用）

```sql
-- profiles（誤り）
id | stamp_count
---|------------
U1 | 3  ❌ レコード数になっている

-- 期待値: 5個
```

---

## 🎯 設計判断の理由

### なぜ `stamp_number` に累積値を記録するのか？

**利点**:
- スタッフ編集でスタンプ数を柔軟に設定できる
- トリガー関数で `MAX(stamp_number)` を使えば正しいスタンプ数が得られる
- 監査証跡として「その時点でのスタンプ数」が分かる

**代替案との比較**:

| 設計 | メリット | デメリット |
|-----|---------|-----------|
| `stamp_number` = 累積値（現在） | スタッフ編集が柔軟 | 訪問回数との区別が必要 |
| `stamp_number` = 訪問回数 | シンプル | スタッフ編集が困難 |

### なぜスタッフ編集機能が必要なのか？

**理由**:
- 誤登録の修正（QRスキャン失敗時など）
- テスト・デモ用途
- データ不整合の修正

---

## 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-02-09 | 初版作成：`stamp_number`の意味を明確化、トリガー関数を`MAX(stamp_number)`に変更 |

---

**関連ドキュメント**:
- [Implementation_Summary_20260209.md](Implementation_Summary_20260209.md)
- [TODO.md](TODO.md)
- [Specification_Change_Log.md](Specification_Change_Log.md)
