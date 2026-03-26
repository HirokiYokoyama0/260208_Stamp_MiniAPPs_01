# スタンプ仕様変更のお知らせ（LIFFアプリ開発者向け）

**作成日:** 2026-03-26
**対象:** LINEミニアプリ（LIFF）開発者
**重要度:** 🔴 高（実装変更が必要）
**関連:** [`52_スタンプ仕様変更_影響範囲分析.md`](52_スタンプ仕様変更_影響範囲分析.md)、[`53_スタンプ仕様変更_実装計画.md`](53_スタンプ仕様変更_実装計画.md)

---

## 📢 変更概要

スタンプ付与量を以下のとおり変更いたします。また、**新規QRコード種別（購買インセンティブ）**を追加します。

### 変更内容サマリー

| 患者区分 / QR種別 | 変更前 | 変更後 | 備考 |
|------------------|-------|-------|------|
| **優良患者様（Premium）** | 10スタンプ | **15スタンプ** | 来院時1回のみ |
| **通常患者様（Regular）** | 5スタンプ | **10スタンプ** | 来院時1回のみ |
| **購買インセンティブ（Purchase）** | - | **5スタンプ** | **新規追加** / 来院時何度でも可 |

### 🎯 LIFFアプリ側で必要な対応

1. **QRコードペイロード解析の更新**（スタンプ数の変更）
2. **新規QR種別（Purchase）のサポート追加**
3. **繰り返しスキャン制御の実装**（Premium/Regularは1日1回、Purchaseは制限なし）
4. **API連携の更新**（`stamp_method` の指定）

---

## 1. QRコードペイロード仕様の変更

### 1-1. 変更前後の比較

#### 変更前（現行仕様）

| 種類 | ペイロード文字列 | 付与スタンプ数 |
|------|------------------|--------------|
| 優良患者様用 | `{"type":"premium","stamps":10}` | 10スタンプ |
| 通常患者様用 | `{"type":"regular","stamps":5}` | 5スタンプ |

#### 変更後（新仕様）

| 種類 | ペイロード文字列 | 付与スタンプ数 | 1日あたり制限 |
|------|------------------|--------------|--------------|
| 優良患者様用 | `{"type":"premium","stamps":15}` | **15スタンプ** | **1回のみ** |
| 通常患者様用 | `{"type":"regular","stamps":10}` | **10スタンプ** | **1回のみ** |
| 購買インセンティブ用 | `{"type":"purchase","stamps":5}` | **5スタンプ** | **制限なし** ← 新規 |

### 1-2. LIFF URLパラメータ形式の変更

カメラ直接起動型のLIFF URLも以下のとおり変更されます。

#### 変更前
```
優良: https://liff.line.me/2009075851-74EieWb4?action=stamp&type=qr&amount=10&location=entrance
通常: https://liff.line.me/2009075851-74EieWb4?action=stamp&type=qr&amount=5&location=entrance
```

#### 変更後
```
優良: https://liff.line.me/2009075851-74EieWb4?action=stamp&type=qr&amount=15&location=entrance
通常: https://liff.line.me/2009075851-74EieWb4?action=stamp&type=qr&amount=10&location=entrance
購買: https://liff.line.me/2009075851-74EieWb4?action=stamp&type=purchase&amount=5&location=shop  ← 新規
```

---

## 2. LIFFアプリ側の実装変更内容

### 2-1. QRコードペイロード解析ロジックの更新

#### 現行の実装例（推測）
```javascript
function parseQRPayload(qrData) {
  try {
    const payload = JSON.parse(qrData);

    if (payload.type === 'premium') {
      return { stamps: 10, method: 'qr_scan' };  // ❌ 旧スタンプ数・旧 method
    } else if (payload.type === 'regular') {
      return { stamps: 5, method: 'qr_scan' };   // ❌ 旧スタンプ数・旧 method
    }
  } catch (error) {
    throw new Error('Invalid QR code');
  }
}
```

#### 🔧 変更後の実装（必須対応）
```javascript
function parseQRPayload(qrData) {
  try {
    const payload = JSON.parse(qrData);

    if (payload.type === 'premium') {
      return {
        stamps: 15,                          // ✅ 10 → 15 に変更
        method: 'qr',                        // ✅ 現在の実装は 'qr'
        repeatable: false,                   // ✅ 1日1回制限
        label: '優良患者様用'
      };
    } else if (payload.type === 'regular') {
      return {
        stamps: 10,                          // ✅ 5 → 10 に変更
        method: 'qr',                        // ✅ 現在の実装は 'qr'
        repeatable: false,                   // ✅ 1日1回制限
        label: '通常患者様用'
      };
    } else if (payload.type === 'purchase') {  // ✅ 新規追加
      return {
        stamps: 5,
        method: 'purchase_incentive',       // ✅ 新しい stamp_method
        repeatable: true,                    // ✅ 制限なし
        label: '購買インセンティブ'
      };
    } else {
      throw new Error('Unknown QR code type');
    }
  } catch (error) {
    throw new Error('Invalid QR code format');
  }
}
```

**重要:** [Doc 48の実装調査](48_実装状況の確認結果_正しい仕様.md)により、現在の実装では **`stamp_method='qr'`** を使用していることが確認されています。`'qr_scan'` は旧実装（後方互換性のため残存）です。

### 2-2. LIFF URLパラメータ解析の更新

#### 🔧 変更が必要な箇所
```javascript
// URLパラメータから取得する場合
const urlParams = new URLSearchParams(window.location.search);
const action = urlParams.get('action');
const type = urlParams.get('type');
const amount = parseInt(urlParams.get('amount'));

if (action === 'stamp') {
  if (type === 'qr') {
    // 来院QR（Premium/Regular）
    // amount が 15 または 10 になる
    const method = 'qr';              // ✅ 現在の実装は 'qr'
    const repeatable = false;
  } else if (type === 'purchase') {  // ✅ 新規追加
    // 購買インセンティブQR
    // amount は 5
    const method = 'purchase_incentive';
    const repeatable = true;
  }
}
```

---

## 3. 繰り返しスキャン制御の実装（重要）

### 3-1. 要件

| QR種別 | 1日あたりのスキャン制限 | 理由 |
|--------|------------------------|------|
| Premium / Regular | **1回のみ** | 来院時の特典（1日1回来院想定） |
| Purchase | **制限なし（何度でも）** | 購買の度にスタンプ付与 |

### 3-2. 実装例

#### 🔧 スキャン時の制御ロジック
```javascript
async function handleQRScan(qrData) {
  const { stamps, method, repeatable, label } = parseQRPayload(qrData);
  const userId = await getLiffUserId();

  // 繰り返し不可のQRコード（来院QR）の場合
  if (!repeatable) {
    const today = new Date().toISOString().split('T')[0];
    const alreadyScanned = await checkTodayStampHistory(userId, method, today);

    if (alreadyScanned) {
      alert(`本日はすでに${label}のスタンプを獲得済みです。\n明日またご利用ください。`);
      return;
    }
  }

  // スタンプ付与API呼び出し
  try {
    await addStamps(userId, stamps, method);
    alert(`${stamps}スタンプを獲得しました！`);
    // スタンプ画面を更新
    updateStampDisplay();
  } catch (error) {
    alert('スタンプ付与に失敗しました。もう一度お試しください。');
    console.error(error);
  }
}

// 今日既にスキャン済みかチェックする関数
async function checkTodayStampHistory(userId, stampMethod, date) {
  try {
    // 管理ダッシュボードのAPIエンドポイント（例）
    const response = await fetch(
      `/api/profiles/${userId}/stamp-history?date=${date}&method=${stampMethod}`,
      {
        headers: {
          'Authorization': `Bearer ${await liff.getIDToken()}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to check stamp history');
    }

    const data = await response.json();
    return data.length > 0;  // レコードがあれば true（スキャン済み）
  } catch (error) {
    console.error('Error checking stamp history:', error);
    // エラー時は安全側に倒す（制限を適用）
    return true;
  }
}
```

### 3-3. ユーザーへの表示メッセージ例

#### スキャン成功時
```
✅ 15スタンプを獲得しました！
現在のスタンプ: 45個
```

#### 二重スキャンエラー時（Premium/Regular）
```
⚠️ 本日はすでに優良患者様用のスタンプを獲得済みです。
明日またご利用ください。
```

#### 購買QRスキャン時（何度でもOK）
```
✅ 5スタンプを獲得しました！（購買特典）
現在のスタンプ: 50個
```

---

## 4. API連携の変更

### 4-1. スタンプ付与APIリクエストの更新

#### 現行の実装例（推測）
```javascript
async function addStamps(userId, stamps, method) {
  const response = await fetch(`/api/profiles/${userId}/stamp`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await liff.getIDToken()}`
    },
    body: JSON.stringify({
      delta: stamps
      // stamp_method の指定なし
    })
  });

  if (!response.ok) {
    throw new Error('Failed to add stamps');
  }

  return await response.json();
}
```

#### 🔧 変更後の実装（推奨）
```javascript
async function addStamps(userId, stamps, method) {
  const response = await fetch(`/api/profiles/${userId}/stamp`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await liff.getIDToken()}`
    },
    body: JSON.stringify({
      delta: stamps,
      stamp_method: method  // ✅ 'qr' または 'purchase_incentive' を指定
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add stamps');
  }

  return await response.json();
}
```

### 4-2. stamp_method の値

| QR種別 | stamp_method の値 | 備考 |
|--------|------------------|------|
| Premium | **`'qr'`** | 来院QR読み取り（現在の実装） |
| Regular | **`'qr'`** | 来院QR読み取り（現在の実装） |
| Purchase | `'purchase_incentive'` | 購買インセンティブQR読み取り ← **新規** |

**重要:**
- [Doc 48の調査結果](48_実装状況の確認結果_正しい仕様.md)により、現在の実装では **`stamp_method='qr'`** を使用
- `'qr_scan'` は旧実装（後方互換性のため残存）
- データベース側で `'purchase_incentive'` を追加するマイグレーションを実施予定

---

## 5. データベース変更について（参考情報）

### 5-1. stamp_history テーブルの変更

管理ダッシュボード側で、`stamp_history.stamp_method` に新しい値を追加しました。

#### 変更前（データベース実装調査に基づく実際の値）
```sql
-- 現在の実装に含まれる stamp_method の値
CHECK (stamp_method IN (
  'qr',                 -- 現在の QR 読み取り実装
  'qr_scan',            -- 旧 QR 読み取り実装（後方互換性）
  'manual_admin',       -- 管理者手動付与
  'import',             -- 一括インポート
  'survey_reward',      -- アンケート報酬
  'slot_game'           -- スロットゲーム
))
```

#### 変更後
```sql
CHECK (stamp_method IN (
  'qr',                 -- 現在の QR 読み取り実装
  'qr_scan',            -- 旧 QR 読み取り実装（後方互換性）
  'manual_admin',       -- 管理者手動付与
  'import',             -- 一括インポート
  'survey_reward',      -- アンケート報酬
  'slot_game',          -- スロットゲーム
  'purchase_incentive'  -- ← 新規追加
))
```

**LIFFアプリ側への影響:**
- API リクエスト時に `stamp_method: 'purchase_incentive'` を指定可能になります
- 来院QRスキャン時は **`'qr'`** を指定してください（現在の実装）
- 購買QRスキャン時は必ず **`'purchase_incentive'`** を指定してください

---

## 6. 後方互換性について

### 6-1. 既存QRコード（旧仕様）の取り扱い

**問題:**
- 変更前に配布・印刷された旧QRコード（Premium=10, Regular=5）が残っている可能性があります

**対応方針（ご相談）:**

#### Option A: 後方互換性を維持（推奨）

旧仕様のQRコードも一定期間サポートする実装

```javascript
function parseQRPayload(qrData) {
  try {
    const payload = JSON.parse(qrData);

    if (payload.type === 'premium') {
      // stamps フィールドの値を優先、なければ新仕様の 15
      const stamps = payload.stamps || 15;
      return {
        stamps: stamps,
        method: 'qr',                        // ✅ 現在の実装は 'qr'
        repeatable: false,
        label: '優良患者様用'
      };
    }
    // Regular も同様
  } catch (error) {
    throw new Error('Invalid QR code format');
  }
}
```

この実装により：
- 旧QRコード（`stamps:10`）→ 10スタンプ付与
- 新QRコード（`stamps:15`）→ 15スタンプ付与

#### Option B: 完全移行（旧QRコードを無効化）

旧QRコードをすべて回収・差し替え後、新仕様のみ受け付ける実装

```javascript
// 固定値で実装（stamps フィールドを無視）
if (payload.type === 'premium') {
  return { stamps: 15, ... };  // 常に15
}
```

**どちらの方針が良いか、ご意見をお聞かせください。**

---

## 7. テストについて

### 7-1. テストQRコードの提供

管理ダッシュボードの [`app/admin/qr`](app/admin/qr) ページで、新仕様のテスト用QRコードを表示できます。

**アクセス方法:**
1. 管理画面にログイン
2. ナビゲーションから「テストQR」または「QRコード」を選択
3. 3種類のQRコードが表示されます：
   - 優良患者様用（15スタンプ）
   - 通常患者様用（10スタンプ）
   - 購買インセンティブ用（5スタンプ）← **新規**

### 7-2. テスト項目チェックリスト

以下の項目をテストしていただけますでしょうか。

#### 基本機能
- [ ] Premium QRをスキャン → 15スタンプ付与される
- [ ] Regular QRをスキャン → 10スタンプ付与される
- [ ] Purchase QRをスキャン → 5スタンプ付与される
- [ ] stamp_history に正しい stamp_method が記録される
  - Premium/Regular → **`'qr'`** （現在の実装）
  - Purchase → `'purchase_incentive'`

#### 繰り返しスキャン制御
- [ ] Premium QRを同日2回スキャン → 2回目はエラーメッセージ表示
- [ ] Regular QRを同日2回スキャン → 2回目はエラーメッセージ表示
- [ ] Purchase QRを同日3回スキャン → すべて成功（制限なし）
- [ ] 日付が変わった後、Premium QRを再度スキャン → 成功

#### エラーハンドリング
- [ ] 不正なQRコード（JSON形式でない）→ エラー表示
- [ ] 未知のtype値（例: `type:"unknown"`）→ エラー表示
- [ ] ネットワークエラー時 → 適切なエラーメッセージ表示

#### UI/UX
- [ ] スタンプ付与成功時、現在のスタンプ数が正しく表示される
- [ ] エラーメッセージが分かりやすい
- [ ] ローディング中の表示がある

### 7-3. テストデータ

**テスト用ユーザー:**
- LINE User ID: （テスト環境のLINEアカウント）
- 初期スタンプ数: 0

**テストシナリオ例:**
1. Premium QR (15) スキャン → 合計 15
2. Purchase QR (5) スキャン → 合計 20
3. Purchase QR (5) 再スキャン → 合計 25
4. Purchase QR (5) 再スキャン → 合計 30
5. Regular QR (10) スキャン → 合計 40
6. Regular QR 再スキャン → エラー（本日スキャン済み）

---

## 8. 実装スケジュール（ご相談）

### 8-1. 管理ダッシュボード側の対応状況

| 項目 | 状況 |
|------|------|
| データベースマイグレーション（stamp_method 追加） | 🟡 準備完了（実施前） |
| QRコード生成ページの更新 | 🟡 準備完了（実装前） |
| ドキュメント作成 | ✅ 完了（本ドキュメント） |

### 8-2. LIFF アプリ側の実装スケジュール（ご記入ください）

| 項目 | 担当 | 予定日 | 状況 |
|------|------|-------|------|
| QRペイロード解析の更新 | | | |
| 新規QR種別（Purchase）のサポート追加 | | | |
| 繰り返しスキャン制御の実装 | | | |
| API連携の更新（stamp_method 指定） | | | |
| テスト実施 | | | |
| デプロイ | | | |

**いつ頃リリース可能か、ご予定をお聞かせください。**

---

## 9. 質問・確認事項

### 9-1. 技術的な質問

**Q1. 繰り返しスキャン制御のチェックはLIFF側で実装すべきか、API側で実装すべきか？**

**A1.** 両方で実装することを推奨します。
- **LIFF側:** UX向上（即座にエラーメッセージ表示）
- **API側:** セキュリティ（クライアント側のチェックを迂回される可能性に対応）

API側での実装例は [`53_スタンプ仕様変更_実装計画.md`](53_スタンプ仕様変更_実装計画.md) の「Step 4-2」に記載しています。

---

**Q2. 購買インセンティブQRの「制限なし」は本当に無制限で良いのか？**

**A2.** 運用上のリスクがあるため、以下の対策を検討中です：

- **対策案1:** 1日あたりの上限回数を設定（例: 最大3回まで）
- **対策案2:** スタッフ承認フローを追加（QRスキャン後、スタッフが承認ボタンを押す）
- **対策案3:** 動的QR生成（購買時に1回限り有効なQRを生成）

**ご意見をお聞かせください。どの対策が実装しやすいですか？**

---

**Q3. 既存QRコード（旧仕様）の後方互換性はどうするか？**

**A3.** 上記「6. 後方互換性について」をご参照ください。Option A（後方互換性維持）または Option B（完全移行）のどちらが良いか、ご意見をお願いします。

---

**Q4. LIFF URLパラメータ形式とペイロード形式（JSON）のどちらを優先すべきか？**

**A4.** 両方サポートすることを推奨しますが、主に使用しているのはどちらですか？
- LIFF URL形式: カメラ直接起動が可能
- ペイロード形式: より柔軟な情報を含められる

---

### 9-2. 運用面での質問

**Q5. 購買インセンティブQRコードはどこに配置する予定か？**

**A5.** 院内の売店やレジ付近を想定していますが、詳細は未定です。スタッフ立会いのもと使用する運用を検討中です。

---

**Q6. リリース時期はいつ頃を予定していますか？**

**A6.** LIFFアプリ側の実装スケジュールに合わせます。ご都合の良い時期をお聞かせください。

---

## 10. サポート・連絡先

ご不明な点やご質問がございましたら、以下までお気軽にご連絡ください。

- **技術的な質問:** 管理ダッシュボード開発チーム
- **仕様に関する質問:** プロダクトマネージャー
- **緊急の問い合わせ:** （連絡先を記載）

---

## 11. 関連ドキュメント

LIFFアプリ開発者向け：
- 本ドキュメント（54_スタンプ仕様変更_LIFFアプリ開発者へ.md）
- [`archive/24_QRコード表示_LIFFアプリ開発者へ.md`](archive/24_QRコード表示_LIFFアプリ開発者へ.md) - 旧仕様（参考用）

管理ダッシュボード側（参考情報）：
- [`52_スタンプ仕様変更_影響範囲分析.md`](52_スタンプ仕様変更_影響範囲分析.md) - 影響範囲分析
- [`53_スタンプ仕様変更_実装計画.md`](53_スタンプ仕様変更_実装計画.md) - 実装計画詳細
- [`51_QRコード表示仕様.md`](51_QRコード表示仕様.md) - QRコード仕様
- [`05_Database_Schema.md`](05_Database_Schema.md) - データベーススキーマ

---

## 12. 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-03-26 | 1.0 | 初版作成 |

---

**お手数をおかけしますが、ご確認のほどよろしくお願いいたします。**

**📅 次回ミーティング候補日時をお知らせください。仕様の詳細について直接ご説明させていただきます。**

---

最終更新: 2026-03-26
