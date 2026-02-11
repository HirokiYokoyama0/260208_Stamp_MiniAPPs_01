# 機能仕様書（統合版）

各機能の詳細仕様を1ファイルに集約。元ファイルは Doc/archive/ に保存。

---

## 1. スタンプシステム

### 1.1 基本仕様

**スタンプ付与ルール:**
- 1回の来院 = 1個のスタンプ（基本ルール）
- 将来的に診療内容によって変更可能（現在は常に1個）

**スタッフ編集機能:**
- 目的: 誤登録の修正、テスト用途
- 制限: なし（何度でも編集可能）
- 監査証跡: すべての編集履歴を `stamp_history` に記録

### 1.2 データベース設計

**stamp_historyテーブル:**

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | UUID | 主キー |
| user_id | TEXT | ユーザーID（profiles.id） |
| visit_date | TIMESTAMPTZ | 来院日時 |
| stamp_number | INTEGER | その時点でのスタンプ数（累積） |
| stamp_method | TEXT | 登録方法（'qr_scan' or 'manual_admin'） |
| qr_code_id | TEXT | QRコードID |
| notes | TEXT | メモ |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

**stamp_numberの意味（重要）:**

`stamp_number` は「その時点でのスタンプ数（累積）」を表す。

```
| visit_date | stamp_number | stamp_method | 説明 |
|-----------|--------------|--------------|------|
| 2月8日 09:00 | 1 | qr_scan | 1回目の来院 → スタンプ1個 |
| 2月9日 10:00 | 2 | qr_scan | 2回目の来院 → スタンプ2個 |
| 2月9日 10:30 | 5 | manual_admin | スタッフが「5個に設定」 |
| 2月9日 11:00 | 4 | manual_admin | スタッフが「4個に修正」 |
```

**訪問回数とスタンプ数の区別:**
- 訪問回数 = `stamp_history` テーブルのレコード数
- スタンプ数 = `MAX(stamp_number)` = `profiles.stamp_count`

### 1.3 トリガー関数: update_profile_stamp_count()

```sql
CREATE OR REPLACE FUNCTION update_profile_stamp_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET
    stamp_count = (
      SELECT COALESCE(MAX(stamp_number), 0)
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

`MAX(stamp_number)` を使用する理由: スタッフ編集でスタンプ数を自由に設定できるようにするため。`COUNT(*)` ではレコード数（訪問回数）しか取得できない。

### 1.4 API仕様

**POST /api/stamps（QRスキャン）:**
1. 現在のスタンプ数を取得（`profiles.stamp_count`）
2. 次のスタンプ数を計算（`currentStampCount + 1`）
3. `stamp_history` に新規レコードを挿入
4. トリガーで `profiles.stamp_count` が自動更新される

**重複チェック:** 同日同QRコードIDの組み合わせで重複防止

### 1.5 画面表示

**スタンプページ（/stamp）:**
- スタンプカウンター: `profiles.stamp_count` を表示
- 訪問回数: `stamp_history` のレコード数を表示
- 来院履歴リスト: 訪問回数、スタンプ数、スタッフ編集フラグ
- QRスキャンボタン

### 1.6 トラブルシューティング

| 症状 | 対処 |
|-----|------|
| スタンプ数が正しくない | トリガー関数が `MAX(stamp_number)` を使っているか確認 |
| 既存データが不正 | `UPDATE profiles SET stamp_count = (SELECT COALESCE(MAX(stamp_number), 0) FROM stamp_history WHERE user_id = profiles.id);` |
| 訪問回数とスタンプ数が混同 | 訪問回数=レコード数、スタンプ数=MAX(stamp_number) |

---

## 2. 特典交換システム

### 2.1 概要

貯まったスタンプで特典と交換できるシステム。患者の再来院モチベーション向上を目的とする。

**積み上げ式（v1.1で変更）:**
- スタンプは交換後も減らない
- 条件を満たせば何度でも交換可能
- 例: 20個貯まれば、5個/10個/15個/20個の特典すべて交換可能

### 2.2 データベース設計

**rewardsテーブル（特典マスター）:**

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | UUID | 主キー |
| name | TEXT | 特典名 |
| description | TEXT | 詳細説明 |
| required_stamps | INTEGER | 必要なスタンプ数 |
| image_url | TEXT | 特典画像URL（オプション） |
| is_active | BOOLEAN | 有効/無効 |
| display_order | INTEGER | 表示順序 |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

**初期特典データ:**

| 特典名 | 必要スタンプ | 内容 |
|-------|-----------|------|
| オリジナル歯ブラシセット | 5個 | 歯ブラシ + 歯磨き粉 |
| フッ素塗布1回無料券 | 10個 | 通常\1,100 → 無料（有効期限6ヶ月） |
| 歯のクリーニング50%OFF券 | 15個 | 通常\5,500 → \2,750（有効期限3ヶ月） |
| ホワイトニング1回30%OFF券 | 20個 | 通常\16,500 → \11,550（有効期限3ヶ月） |

**reward_exchangesテーブル（交換履歴）:**

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | UUID | 主キー |
| user_id | TEXT | ユーザーID |
| reward_id | UUID | 特典ID |
| stamp_count_used | INTEGER | 使用したスタンプ数 |
| exchanged_at | TIMESTAMPTZ | 交換日時 |
| status | TEXT | pending / completed / cancelled |
| notes | TEXT | メモ |

### 2.3 API仕様

**GET /api/rewards:** 有効な特典一覧を取得

**POST /api/rewards/exchange:** 特典を交換（積み上げ式）
- リクエスト: `{ userId, rewardId }`
- スタンプ数チェック → 条件を満たしていれば `reward_exchanges` に記録
- スタンプ数は減らさない

### 2.4 ステータス管理

| ステータス | 意味 | 運用 |
|-----------|------|------|
| pending | 交換申請済み | 受付で特典を提供する前 |
| completed | 提供完了 | 受付で実際に特典を渡した後 |
| cancelled | キャンセル | 誤交換などの取り消し |

### 2.5 運用: 特典の追加・変更

```sql
-- 新しい特典を追加
INSERT INTO rewards (name, description, required_stamps, display_order)
VALUES ('歯間ブラシセット', '歯間ブラシ5本セット', 8, 5);

-- 特典を無効化（削除せず非表示）
UPDATE rewards SET is_active = false WHERE id = 'uuid';
```

---

## 3. スタッフ手動スタンプ機能

### 3.1 概要

QRコードが読み取れない場合のリスク対応として、受付スタッフが手動でスタンプ数を変更できる機能。

### 3.2 操作フロー

```
患者からスマホを預かる
  → ページ最下部のバージョン情報を3回連続タップ
  → 暗証番号入力ダイアログ表示
  → 暗証番号「1234」を入力
  → スタンプ数編集画面（+/-ボタン）
  → 「更新」で反映
  → 患者にスマホを返却
```

### 3.3 API仕様

**POST /api/stamps/manual:**

リクエスト:
```json
{
  "userId": "U1234567890abcdef",
  "staffPin": "1234",
  "newStampCount": 6
}
```

動作:
1. 暗証番号チェック
2. `profiles.stamp_count` を直接更新
3. `stamp_history` に監査証跡を記録（`stamp_method: 'manual_admin'`）
4. トリガーで `profiles.stamp_count` が再計算（`MAX(stamp_number)`）

### 3.4 セキュリティ

| 対策 | 内容 |
|-----|------|
| 隠しリンク | 3回連続タップでのみ表示 |
| 暗証番号 | スタッフのみ知っている（環境変数 `NEXT_PUBLIC_STAFF_PIN`） |
| 監査証跡 | stamp_historyに手動付与を記録 |
| スマホ預かり前提 | 患者自身は操作しない |

**監査証跡の識別:**
- `stamp_method`: `'manual_admin'`
- `qr_code_id`: `MANUAL-ADJUST-{YYYYMMDD}-{HHMMSS}` 形式
- `notes`: `スタッフ操作: +1個 (5 → 6)` 等

### 3.5 制限事項

- 操作回数制限なし（柔軟な修正に対応するため）
- スタンプ数の範囲: 0〜999個
- 暗証番号: 月次で変更推奨

---

## 4. LINE友だち登録促進機能

### 4.1 概要

LIFF起動時に `liff.getFriendship()` を使用し、公式LINE（@550mlcao）の友だち登録状態をチェック。未登録の場合に登録を促す。

**目的:**
- 再来院促進（リマインド通知）
- エンゲージメント向上（キャンペーン情報配信）
- 友だち登録状況のSupabase管理

### 4.2 データベース設計

**profiles.is_line_friend カラム:**

| 値 | 意味 |
|---|------|
| NULL | まだ確認していない |
| true | 公式LINEの友だち |
| false | 公式LINEの友だちではない |

### 4.3 表示タイミング

| シーン | 条件 | 頻度 |
|-------|------|------|
| 初回起動時モーダル | `isFriend === false` | 1日1回（LocalStorageで管理） |
| 医院情報ページ | `isFriend === false` | 常に表示 |

### 4.4 実装ファイル

| ファイル | 役割 |
|---------|------|
| hooks/useLiff.ts | `liff.getFriendship()` 呼び出し、Supabaseキャッシュ |
| components/features/FriendshipPromptModal.tsx | 友だち登録促進モーダル |
| components/layout/AppLayout.tsx | 初回起動時モーダル表示制御 |
| components/(adult)/AdultInfoPage.tsx | 友だち登録状態の表示 |

### 4.5 友だち追加フロー

```
モーダルまたは医院情報ページで「友だち追加する」をタップ
  → https://line.me/R/ti/p/@550mlcao を新しいタブで開く
  → ユーザーが公式LINEを友だち追加
  → 次回LIFF起動時に liff.getFriendship() → friendFlag = true
  → Supabase profiles.is_line_friend が自動更新
```

### 4.6 運用: 友だち登録状況の確認

```sql
-- 友だち登録率
SELECT
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE is_line_friend = true) / COUNT(*),
    2
  ) AS friend_rate_percent
FROM profiles;
```

---

## 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-02-11 | 4つの仕様書を統合（Feature_Specifications.md 初版） |
| 2026-02-09 | スタンプシステム設計書 初版 |
| 2026-02-09 | 特典交換システム仕様書 v1.0→v1.1（積み上げ式に変更） |
| 2026-02-09 | スタッフ手動スタンプ仕様書 v1.0→v2.0（自由編集機能） |
| 2026-02-09 | LINE友だち登録促進機能仕様書 初版 |

---

**統合元ファイル（Doc/archive/ に保存）:**
- Stamp_System_Design.md
- Rewards_System_Specification.md
- Staff_Manual_Stamp_Specification.md
- LINE_Friendship_Feature_Specification.md
