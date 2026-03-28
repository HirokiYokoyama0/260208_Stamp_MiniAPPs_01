# 調査報告：iPhoneでのスタンプ付与問題

**作成日**: 2026-03-28
**優先度**: 🔴 高（本番環境での報告）

## 📋 報告された事象

ユーザーテストにおいて、iPhone利用者から以下の問題が報告されました：

### 事象1: 15スタンプQRが10ポイントしか付与されない
- **状況**: 優良患者様用QR（15スタンプ）をスキャンしたが、10ポイントのみ付与された
- **注意**: 別の携帯では15ポイント正常に付与された（つまり再現性が不安定）

### 事象2: 購買インセンティブQRが1度しかスキャンできない
- **状況**: 購買インセンティブQRコードが1度のみしかスキャンできなかった
- **期待動作**: 購買インセンティブは回数制限なくスキャン可能なはず

## 🔍 重要な前提条件

- ✅ **Androidテストでは問題なし**（事前テストで正常動作確認済み）
- ⚠️ **iPhone特有の問題の可能性が高い**

## 📱 技術的分析

### 1. コード実装の確認結果

#### app/api/stamps/scan/route.ts
```typescript
// Line 155: スタンプ個数はリクエストの stamps パラメータをそのまま使用
const nextStampNumber = currentStampCount + stamps;

// Line 163: stamp_number に正しく設定
stamp_number: nextStampNumber,

// Line 166: amount にも正しく設定
amount: stamps,
```

**✅ API側の実装は正しい** - リクエストの`stamps`パラメータをそのまま使用

#### app/scan/page.tsx
```typescript
// Line 139-141: 購買インセンティブは毎回ユニークなIDを生成
const qrCodeId = payload.type === 'purchase'
  ? `${payload.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  : `${payload.type}_${new Date().toISOString().split('T')[0]}`;

// Line 143-154: APIリクエスト
const response = await fetch('/api/stamps/scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: profile!.userId,
    type: payload.type,
    stamps: payload.stamps,  // ペイロードの stamps をそのまま送信
    qrCodeId,
  }),
});
```

**✅ フロントエンド実装も正しい** - QRコードペイロードの`stamps`をそのまま送信

#### app/api/stamps/scan/route.ts（1日1回制限）
```typescript
// Line 110-152: 1日1回制限チェック
if (type !== "purchase") {
  // 購買インセンティブは対象外
  // ...
  .eq("stamp_method", "qr")  // QRコードのみチェック
```

**✅ 購買インセンティブは1日1回制限の対象外** - 正しく除外されている

### 2. 考えられる原因

#### 事象1の原因候補（15→10ポイント）

##### ❌ 除外: コード実装の問題
- API、フロントエンド共に実装は正しい
- Androidでは正常動作している

##### ⚠️ 可能性大: QRコードペイロード自体の問題
- iPhone でスキャンされた QR コードが `{"type":"premium","stamps":10}` になっている
- QR コード生成時に間違ったペイロードが含まれている可能性
- **確認方法**: QR コード生成側（管理ダッシュボード）のペイロード確認が必要

##### ⚠️ 可能性中: iPhone の LIFF scanCodeV2 の挙動
- iPhone と Android で `scanCodeV2` の戻り値が異なる可能性
- JSON パースエラーが silent に発生している可能性
- **対策**: デバッグログを追加してペイロードの生値を確認

##### ⚠️ 可能性小: データベース制約
- `stamp_history.amount` カラムのデフォルト値が `10`（008マイグレーション）
- もし INSERT 時に `amount` が NULL になると 10 になる
- **しかし**: API コードでは必ず `stamps` を設定しているため可能性低い

#### 事象2の原因候補（購買インセンティブ1回制限）

##### ❌ 除外: 1日1回制限の適用
- コード上、購買インセンティブは1日1回制限の**対象外**
- `type !== "purchase"` で正しく除外されている

##### ⚠️ 可能性大: ユーザーの誤解
- 実は正常に複数回スキャンできているが、UI の表示が分かりにくい
- 別のエラーメッセージが出ている（例: "無効なQRコードです"）
- **対策**: エラーメッセージのログ収集が必要

##### ⚠️ 可能性中: QRコードIDの重複チェック
- フロントエンドで毎回ユニークなIDを生成しているが、何らかの理由で同じIDになっている
- **しかし**: `Date.now()` + `Math.random()` なので可能性は極めて低い

##### ⚠️ 可能性小: データベースのユニーク制約
- `qr_code_id` にユニーク制約がある？
- **確認**: 002マイグレーションではユニーク制約はない（インデックスのみ）

## 🔧 次のアクション

### 優先度1: データベース確認

`scripts/debug-stamp-issues.sql` を実行して実際のデータを確認：

```sql
-- ① 最近のスタンプ履歴（amount を確認）
-- ② Premium QR のレコード確認（amount = 15 か 10 か）
-- ③ 購買インセンティブのレコード確認（複数回記録されているか）
```

### 優先度2: デバッグログの強化

以下の箇所でログを追加して、iPhone実機でテスト：

1. **QRコード生値のログ**: `app/scan/page.tsx:114` - 既に存在 ✅
2. **パース後のペイロードログ**: `app/scan/page.tsx:120` - 既に存在 ✅
3. **API受信パラメータログ**: `app/api/stamps/scan/route.ts:46-51` - 既に存在 ✅

→ **既にログは十分** - ユーザーにブラウザのコンソールログを確認してもらう

### 優先度3: QRコード生成側の確認

管理ダッシュボード開発者に以下を確認：
- 優良患者様用QRコードのペイロードが `{"type":"premium","stamps":15}` になっているか
- 通常患者様用QRコードのペイロードが `{"type":"regular","stamps":10}` になっているか
- 購買インセンティブQRコードのペイロードが `{"type":"purchase","stamps":5}` になっているか

### 優先度4: iPhone実機でのデバッグ

1. Safari の Web インスペクタを使用して LIFF アプリのコンソールログを確認
2. 以下の値を確認：
   - `scanCodeV2` の戻り値（`result.value`）
   - パース後の `payload.stamps` の値
   - API レスポンスの `stampsAdded` の値

## 📊 診断フローチャート

```
iPhone でスキャン
    ↓
[デバッグログ確認]
    ↓
QRコード生値は正しい？
    ├─ NO → QRコード生成側の問題
    └─ YES
        ↓
    パース後の stamps は正しい？
        ├─ NO → LIFF scanCodeV2 の問題（iPhone特有）
        └─ YES
            ↓
        API リクエストの stamps は正しい？
            ├─ NO → フロントエンドの問題
            └─ YES
                ↓
            DB の amount は正しい？
                ├─ NO → API またはトリガーの問題
                └─ YES → 問題なし（表示の誤解？）
```

## 📝 暫定対応

iPhone でのテストを継続しながら、以下を実施：

1. **データベースログの確認**: `scripts/debug-stamp-issues.sql` 実行
2. **QRコード生成側の確認依頼**: 管理ダッシュボード開発者へ連絡
3. **ユーザーへのヒアリング**:
   - どのQRコードをスキャンしたか（院内のどこ？）
   - エラーメッセージは出たか
   - スタンプ履歴タブで何個増えたか確認できるか

## 🔗 関連ファイル

- [app/api/stamps/scan/route.ts](app/api/stamps/scan/route.ts)
- [app/scan/page.tsx](app/scan/page.tsx)
- [supabase/002_create_stamp_history_table.sql](supabase/002_create_stamp_history_table.sql)
- [supabase/008_add_10x_system_columns.sql](supabase/008_add_10x_system_columns.sql)
- [scripts/debug-stamp-issues.sql](scripts/debug-stamp-issues.sql)
