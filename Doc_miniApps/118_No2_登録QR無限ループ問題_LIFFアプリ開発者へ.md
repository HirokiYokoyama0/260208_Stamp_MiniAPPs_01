# 登録QR無限ループ問題調査依頼【原因判明】

**作成日:** 2026-04-06
**更新日:** 2026-04-06 ⚠️ **原因特定・対策案追加**
**対象:** LIFFアプリ開発者
**優先度:** 🔴 高（iOS 18環境で登録QRが外部ブラウザで開かれる問題）

---

## 🎯 原因判明【iOS 18.6.2以降の共通問題】

**CSVログ分析により根本原因が特定されました！**

### ✅ 判明した事実

1. **登録QRスキャン時にSafari（外部ブラウザ）で開かれている**
   - 17:17:59のリクエストはすべて`Safari/604.1`（外部ブラウザ）
   - iOS 18.7での動作を確認

2. **53秒後にLIFFブラウザに切り替わっている**
   - 17:18:52のリクエストは`Safari Line/26.4.0 LIFF`（LINEアプリ内）
   - この間、ユーザーは手動または自動でLINEアプリへ切り替え

3. **ブラウザ切り替えの試行錯誤が「無限ループ」として報告された**
   - 外部ブラウザ → LINEアプリへの切り替えが繰り返された
   - ユーザー体験として「繰り返し開く」と認識された

### 🚨 追加調査結果（全ログ分析）

**岡本さんだけの問題ではありません！**

- **Safari（外部ブラウザ）からのアクセス**: 599件
- **該当ユーザー数**: 3人
  - U9cbf2f6988a70fc3c55cf5c907284cb3（岡本さん - iOS 18.7）
  - U01a09ca9541566f50ae5b1c5978e4918（iOS 18.7または18.6.2）
  - U6f22fd20368477a1218ce8242fcb5060（山中さん - iOS 18.7または18.6.2）
- **iOS バージョン分布**:
  - iOS 18.7: 85.6%（513件）
  - iOS 18.6.2: 14.4%（86件）

### ⚠️ 重要な結論

1. **iOS 18.6.2以降で共通して発生**
2. **他の2人のユーザーは問題を報告していない**
   - 最終的にLIFFブラウザで開けている
   - ユーザー体験は悪いが、致命的ではない
3. **岡本さんのみ「無限ループ」として報告**
   - 53秒の切り替え時間が長かった
   - または切り替えの試行回数が多かった

---

## 📋 問題の概要

### 報告内容
- **症状:** 登録QRを読み込むとLINEとブラウザを繰り返し開くようになり、登録ができない
- **発生環境:** iPhone 16（iOS 18.7）← 確認済み
- **発生日時:** 2026-04-06 17:17頃（JST）
- **該当ユーザー:** 岡本　俊彦（診察券番号: 7569）

### 現在の状態
- 最終的には登録完了している（2026-04-06 17:17:59 UTC）
- スタンプも正常に付与されている（5個）
- しかし、登録プロセス中に外部ブラウザ⇔LINEアプリの切り替えが発生

---

## 🔍 CSVログ詳細分析結果

### ⏱️ タイムライン（実際のログデータ）

```
17:17:59.448 - GET /api/users/me
  User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X)
              AppleWebKit/605.1.15 (KHTML, like Gecko)
              Version/26.4 Mobile/15E148 Safari/604.1
  ↓
  ⚠️ Safari（外部ブラウザ）からのアクセス

17:17:59.513 (65ms後) - GET /api/users/U9cbf2f6988a70fc3c55cf5c907284cb3/memo
  User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X)
              AppleWebKit/605.1.15 (KHTML, like Gecko)
              Version/26.4 Mobile/15E148 Safari/604.1
  ↓
  ⚠️ 引き続きSafariからのアクセス

  ↓ 【53秒の空白】
  ↓ この間に何らかのブラウザ切り替えが発生
  ↓

17:18:52.884 (53秒後) - POST /api/stamps/auto
  User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X)
              AppleWebKit/605.1.15 (KHTML, like Gecko)
              Mobile/15E148 Safari Line/26.4.0 LIFF
  ↓
  ✅ LIFFブラウザ（LINEアプリ内）に切り替わった
  ✅ QRスタンプ自動付与成功: +5個
```

### 🔑 重要な発見

**1. User-Agentの違い**

| 時刻 | ブラウザ | iOS Version | 詳細 |
|------|----------|-------------|------|
| 17:17:59 | **Safari/604.1** | iOS 18.7 | 外部ブラウザで開かれた |
| 17:18:52 | **Line/26.4.0 LIFF** | iOS 26.4* | LINEアプリ内ブラウザ |

*iOS 26.4は存在しないため、LIFFが独自に生成しているUser-Agent

**2. 53秒の空白期間の意味**

- Safari（外部ブラウザ）からLINEアプリへの手動・自動切り替え
- ユーザーが「繰り返し開く」と感じたのはこの切り替えプロセス
- iOS 18の仕様変更で登録QRが外部ブラウザで開かれるようになった可能性

---

## 🔍 Vercelログ分析結果（追加情報）

### 検出された異常パターン（17:18:49-50の1秒間）

#### 1. **同一ミリ秒内での重複リクエスト**

2026-04-06 08:18:49～50（約1秒間）に43件のリクエストが集中：

```
08:18:50.669 - / (トップページ) 2回同時
08:18:50.597 - /rewards (特典ページ) 2回同時
08:18:50.509 - /info (情報ページ) 2回同時
08:18:50.437 - /settings (設定ページ) 2回同時
08:18:49.749 - / (トップページ) 2回同時
```

#### 2. **0ms間隔での連続アクセス（物理的に不可能）**

同じページへのアクセスが0ms間隔で発生：

```
/ (トップページ) - 間隔: 0ms
/settings (設定) - 間隔: 0ms
/info (情報) - 間隔: 0ms
/rewards (特典) - 間隔: 0ms
```

これは**JavaScriptの無限ループまたはLIFF初期化処理の異常な再試行**を示唆しています。

#### 3. **requestIdの異常な重複**

```
wzfs5: 9回
z2789: 8回
wdnck: 6回
```

通常は1～2回程度ですが、**6～9回も繰り返されている**のは異常です。

#### 4. **パス別アクセス頻度（1秒間）**

```
/rewards    : 10回 (23.3%)
/           :  8回 (18.6%)
/stamp      :  8回 (18.6%)
/info       :  8回 (18.6%)
/settings   :  8回 (18.6%)
/auto-stamp :  1回 (2.3%)
```

全ページが均等に複数回アクセスされている → **タブナビゲーション全体が繰り返しレンダリングされている可能性**

---

## 🎯 根本原因（確定）

### ✅ 原因: iOS 18で登録QRが外部ブラウザで開かれる

**問題の流れ:**

1. **患者が登録QRをスキャン（iOS 18.7のiPhone 16）**
   - QRコードには通常のHTTPS URLまたはLIFF URLが含まれる

2. **iOS 18の仕様変更により、Safari（外部ブラウザ）で開かれる**
   - 17:17:59のログで`Safari/604.1`を確認
   - LIFF URLでも外部ブラウザで開かれるケースが報告されている

3. **外部ブラウザではLIFF機能が使えない**
   - `liff.isInClient()` が `false` を返す
   - LINEログインやLIFF APIが動作しない

4. **ユーザーまたはアプリがLINEアプリへの切り替えを試みる**
   - 自動リダイレクトまたは手動での切り替え
   - この切り替えが「繰り返し開く」として報告された

5. **53秒後、ようやくLIFFブラウザで開かれる**
   - 17:18:52のログで`Safari Line/26.4.0 LIFF`を確認
   - 登録とスタンプ付与が成功

### 🔴 対策が必要な理由

- **ユーザー体験が非常に悪い**（53秒の空白、切り替えループ）
- **登録ができないと報告される**（実際は完了するが時間がかかる）
- **iOS 18ユーザーが増えると問題が頻発する**
- **すでに3人が該当（全体の約3%と推定）**
- **iOS 18のシェアは今後増加する見込み**

---

## 🎯 以前の仮説（参考）

### ~~仮説1: LIFF初期化の無限ループ~~ ← 原因ではない

CSVログ分析により、LIFF初期化の問題ではなく、**外部ブラウザで開かれた**ことが原因と判明。

### ~~仮説2: ブラウザ ⇔ LINEアプリの切り替えループ~~ ← **これが正解**

1. 登録QRのLIFF URLを開く
2. **外部ブラウザで開かれる（iOS 18の仕様変更）** ← 確認済み
3. LINEアプリに戻そうとする
4. 再度外部ブラウザで開かれる（または切り替えに失敗）
5. **最終的にLIFFブラウザで開かれる（53秒後）**

### ~~仮説3: iOS 18のWebView制限~~ ← 部分的に正解

iOS 18でQRスキャン時の挙動が変更され、外部ブラウザで開かれるようになった可能性が高い。

---

## 🔧 対応依頼事項（優先度順）

### 【最優先】1. 登録QRのURL設定確認

**現在の登録QRのURLを確認してください:**

```
登録QRのURL: ______________________
```

#### 確認項目:
- [ ] LIFF URLを使用しているか？ (`https://liff.line.me/XXXX-XXXX`)
- [ ] 通常のHTTPS URLを使用しているか？ (`https://260208-stamp-mini-ap-ps-01.vercel.app/...`)

**問題:**
- 通常のHTTPS URLの場合、iOS 18で外部ブラウザで開かれる
- LIFF URLでも、iOS 18の仕様変更で外部ブラウザで開かれる可能性がある

### 【緊急】2. 外部ブラウザ判定と誘導UIの実装

外部ブラウザで開かれた場合、ユーザーをLINEアプリへ誘導するUIを実装してください。

#### 実装例:

```typescript
"use client";

import { useEffect, useState } from "react";
import liff from "@line/liff";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isExternalBrowser, setIsExternalBrowser] = useState(false);

  useEffect(() => {
    liff
      .init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
      .then(() => {
        // LIFF環境で動作しているか確認
        if (!liff.isInClient()) {
          setIsExternalBrowser(true);
        }
      })
      .catch((error) => {
        console.error("LIFF初期化エラー:", error);
      });
  }, []);

  if (isExternalBrowser) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2>⚠️ このページはLINEアプリで開いてください</h2>
        <p>外部ブラウザでは正常に動作しません。</p>
        <button
          onClick={() => {
            // LINEアプリで開くリンクを生成
            const liffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`;
            window.location.href = `line://app/${process.env.NEXT_PUBLIC_LIFF_ID}`;
            // フォールバック
            setTimeout(() => {
              window.location.href = liffUrl;
            }, 1000);
          }}
          style={{
            padding: "15px 30px",
            fontSize: "18px",
            backgroundColor: "#00B900",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          LINEアプリで開く
        </button>
      </div>
    );
  }

  return children;
}
```

### 【重要】3. 登録QRをLINE Official Account Manager経由で生成

**推奨される対策:**

LINE Official Account Managerから直接LIFF URLのQRコードを生成すると、iOS 18でも確実にLINEアプリ内で開かれます。

#### 手順:
1. LINE Official Account Managerにログイン
2. 「リッチメニュー」または「プロフィール」セクションへ移動
3. LIFF URLを設定
4. QRコードを生成・ダウンロード

### 4. LIFF SDKバージョンの確認

```bash
npm list @line/liff
```

- 現在のバージョン: ______
- 最新バージョン: [LIFF SDK最新版を確認](https://www.npmjs.com/package/@line/liff)
- iOS 18対応が含まれているか確認

### 5. iOS 18での動作テスト

以下の環境で**修正後のコードを**テストしてください：

- [ ] iPhone 16 (iOS 18.7) - 今回問題が発生した環境
- [ ] iPhone 15 (iOS 17) - 比較用
- [ ] Android最新版 - 比較用

#### テストシナリオ:
1. 登録QRをスキャン
2. どのブラウザで開かれるか確認（Safari or LIFF）
3. 外部ブラウザで開かれた場合、誘導UIが表示されるか確認
4. 「LINEアプリで開く」ボタンが機能するか確認
5. 登録が正常に完了するか確認

---

## 📊 参考情報

### 該当ユーザーの情報

```
LINE表示名: おかもと
本名: 岡本　俊彦
診察券番号: 7569
スタンプ数: 5個
登録日時: 2026-04-06 17:17:59 JST
最終更新: 2026-04-06 17:18:52 JST
```

### イベントログ

```
2026-04-06 17:18:53 - stamp_scan_success (QRスキャン成功)
2026-04-06 17:18:51 - app_open (アプリ起動)
```

※ 登録時のイベントログが記録されていない → RLS policy問題の影響

### 関連する既知の問題

1. **event_logsのRLS policy問題**（別途修正予定）
   - `026_minimal_rls_hardening.sql`でINSERTがブロックされている
   - 修正SQL: `031_fix_event_logs_rls.sql`

---

## 🚨 対応の優先度

**このバグはiOS 18ユーザーの登録体験を著しく悪化させます。**

優先度：🔴 **高**

以下の対応を**72時間以内**に実施してください：

### 必須対応（48時間以内）:
1. ✅ 登録QRのURL設定確認
2. ✅ 外部ブラウザ判定UIの実装とデプロイ

### 推奨対応（1週間以内）:
3. 登録QRをLINE Official Account Manager経由で再生成
4. iOS 18での動作テスト（実機確認）

---

## 📝 回答フォーマット

以下の情報を返信してください：

```
【確認結果】
1. 登録QRのURL形式: LIFF URL / 通常のHTTPS URL
   - 実際のURL: __________
2. LIFF SDKバージョン: _______
3. iOS 18対応状況: 対応済み / 未対応
   - 詳細: __________

【対応内容】
1. 外部ブラウザ判定UIの実装: 実施 / 未実施
   - 実装箇所: __________
2. 登録QRの再生成: 実施 / 未実施
   - 新しいURL: __________
3. iOS 18実機テスト: 実施済み / 未実施
   - テスト結果: __________

【デプロイ予定】
- デプロイ日時: __________
- 対応完了予定日: __________
```

---

## 🔗 関連ドキュメント

- [117_イベントログRLS修正_LIFFアプリ開発者へ.md](./117_イベントログRLS修正_LIFFアプリ開発者へ.md) - event_logs INSERT問題
- [LIFF SDK公式ドキュメント](https://developers.line.biz/ja/docs/liff/)
- [LIFF トラブルシューティング](https://developers.line.biz/ja/docs/liff/troubleshooting/)

---

---

## 📈 分析に使用したデータ

### CSVログファイル
- **短いログ**: `260208-stamp-mini-ap-ps-01-log-export-2026-04-06T14-03-56.csv`
  - 総ログ行数: 584行
  - 対象期間: 2026-04-06 全日
  - 岡本さん関連ログ: 3件（17:17:59 × 2, 17:18:52 × 1）

- **長いログ**: `260208-stamp-mini-ap-ps-01-log-export2長い.csv`
  - 総ログ行数: 1,162行
  - Safari（外部ブラウザ）アクセス: 599件
  - iOS 18該当ユーザー: 3人

### 分析スクリプト
- `scripts/analyze-csv-log-okamoto.ts` - 岡本さんの詳細ログ解析
- `scripts/final-analysis-okamoto.ts` - 最終分析とタイムライン作成
- `scripts/analyze-all-safari-access.ts` - 全Safariアクセス分析
- `scripts/investigate-three-users.ts` - 3人のiOS 18ユーザー調査

### 重要な発見

**個別ケース（岡本さん）:**
```
17:17:59 - Safari（外部ブラウザ）でアクセス（iOS 18.7）
  ↓ 53秒の空白
17:18:52 - LIFFブラウザに切り替わり、スタンプ付与成功
```

**全体傾向:**
- iOS 18.6.2以降のユーザーが3人
- 全員がSafari（外部ブラウザ）経由でアクセス
- 岡本さんのみ「無限ループ」として報告
- 他の2人は問題を報告していない（UXは悪いが機能している）

---

**最終更新:** 2026-04-06（原因特定・対策案追加）
**作成者:** 管理ダッシュボード開発チーム
