# つくばホワイト歯科 × ハブラーシカ LINEミニアプリ TODO

## 完了済みタスク ✅

### 基礎実装（2026-02-08）
- [x] Next.js 15 (App Router) プロジェクトセットアップ
- [x] Tailwind CSS 設定（スカイブルー・シャンパンゴールドのカスタム色）
- [x] LIFF SDK統合（@line/liff）
- [x] カスタムフック `useLiff.ts` 実装
  - LIFF初期化
  - ログイン状態管理
  - プロフィール取得
- [x] 4タブボトムナビゲーション実装
  - 診察券タブ
  - スタンプタブ
  - ケア記録タブ
  - 医院情報タブ
- [x] ホーム画面（診察券タブ）基本実装
  - デジタル診察券カード表示
  - ハブラーシカメッセージ表示
  - スタンプ進捗ゲージ
  - QRスキャンボタン
- [x] QRスキャン機能コンポーネント実装
  - `liff.scanCodeV2()` 統合

### セキュリティ対応（2026-02-08）
- [x] Next.js 15.1.0 → 16.1.6 アップデート（CVE-2025-66478 脆弱性対応）
- [x] React 19.0.0 → 19.2.4 アップデート
- [x] eslint-config-next 15.1.0 → 16.1.6 アップデート
- [x] .gitignore に `.claude` と `.env.local` を追加
- [x] 依存関係の脆弱性チェック（0件確認）

### Supabase連携（2026-02-08）
- [x] Supabase接続設定（lib/supabase.ts）
- [x] profilesテーブル作成（アプローチ1: id を TEXT型）
- [x] ユーザー情報の自動保存機能（UPSERT）
- [x] スタンプ数のリアルタイム表示機能（stamp_count）
- [x] 最終アクセス日時表示機能（updated_at）
- [x] 診察券番号表示機能（ticket_number）
- [x] 接続テスト成功

### ドキュメント整備（2026-02-08）
- [x] プロジェクト仕様書作成
- [x] ファイル構成ドキュメント作成・更新
- [x] TODO管理ファイル作成
- [x] Supabaseセットアップガイド作成

### 予約システム連携（2026-02-14）
- [x] 診察券番号コピー機能実装
  - [x] Clipboard API統合
  - [x] ワンタップで診察券番号をコピー
  - [x] コピー完了の視覚的フィードバック
- [x] アポツール予約ボタン実装
  - [x] 診察券カードに「予約する（アポツール）」ボタン追加
  - [x] タップ時に診察券番号を自動コピー
  - [x] アポツールURL（https://reservation.stransa.co.jp/5d62710843af2685c64352ed3eb9d043）を新規タブで開く
  - [x] 診察券番号未登録時の対応
- [x] 診察券タブUIデザイン改善
  - [x] メインボタン（予約する）の洗練（横幅90%、シャドウ、ホバー効果）
  - [x] サブボタン（来院スタンプ）の控えめ化（グレー、小さめ）
  - [x] セクション間余白の均等化（28px）
  - [x] ボタン文字サイズの最適化（「予約する」16px、「アポツール」12px）

### 開発環境整備（2026-02-14）
- [x] ngrok導入とセットアップ
  - [x] ngrok v3.36.1インストール（winget）
  - [x] authtoken設定
  - [x] ローカル開発サーバーのトンネル構築
  - [x] next.config.mjsにallowedDevOrigins設定
- [x] lucide-react最新版アップデート（0.460.0 → 0.564.0）
  - [x] TypeScript型定義エラー解消

### 次回メモ機能（2026-02-14）
- [x] データベース設計・マイグレーション
  - [x] profiles テーブルにカラム追加（next_visit_date, next_memo, next_memo_updated_at）
  - [x] 部分インデックス作成
  - [x] 自動更新トリガー実装
- [x] API実装
  - [x] GET /api/users/[userId]/memo（次回メモ取得）
  - [x] PUT /api/users/[userId]/memo（次回メモ更新）
  - [x] バリデーション実装（日付形式、200文字制限）
- [x] フロントエンド実装
  - [x] AdultHome.tsx にメモ表示機能追加（4つの表示パターン）
  - [x] タイムゾーン問題修正（日付フォーマット関数）
  - [x] データ取得の統合（ログイン時、スタンプ獲得後、特典交換後）
- [x] 管理画面実装
  - [x] /admin/memo ページ作成（簡易編集画面）
  - [x] ユーザーID入力、日付選択、メッセージ入力
  - [x] リアルタイムプレビュー機能
- [x] ドキュメント整備
  - [x] 03_機能仕様書.md に5章追加
  - [x] 90_実装履歴.md に記録
  - [x] 10_TODO.md 更新

### 予約ボタンクリック数トラッキング機能（2026-02-14）
- [x] データベース設計・マイグレーション
  - [x] profiles テーブルに reservation_button_clicks カラム追加（INTEGER, DEFAULT 0）
  - [x] インデックス作成（idx_profiles_reservation_clicks）
  - [x] PostgreSQL関数 increment_reservation_clicks() 作成
- [x] API実装
  - [x] POST /api/users/[userId]/reservation-click（クリック数+1）
  - [x] エラーハンドリング実装（400/404/500）
  - [x] supabase.rpc() でDB関数呼び出し
- [x] フロントエンド実装
  - [x] AdultHome.tsx の handleReservation() に7行追加
  - [x] 非同期fetch実装（awaitなし）
  - [x] エラー握りつぶし（.catch() + console.error）
- [x] ドキュメント整備
  - [x] 03_機能仕様書.md に6章追加
  - [x] 90_実装履歴.md に記録
  - [x] 10_TODO.md 更新

### Phase 1: 10倍整数システムへの移行（2026-02-16）✅
- [x] データベースマイグレーション
  - [x] 008_add_10x_system_columns.sql 作成
  - [x] profiles.visit_count カラム追加（純粋な来院回数）
  - [x] stamp_history.amount カラム追加（今回付与したポイント）
  - [x] トリガー関数更新（visit_count 自動計算）
- [x] ユーティリティ関数作成
  - [x] lib/stamps.ts に calculateStampDisplay() 追加
  - [x] lib/stamps.ts に formatStampCount() 追加
  - [x] STAMP_AMOUNTS 定数定義
- [x] フロントエンド修正
  - [x] AdultHome.tsx のスタンプ表示ロジック変更（進捗ゲージ追加）
  - [x] AdultStampPage.tsx のスタンプ表示ロジック変更
  - [x] AdultRewardsPage.tsx のスタンプ表示ロジック変更
- [x] API修正
  - [x] /api/stamps の付与量を +1 → +10 に変更
  - [x] /api/stamps に amount カラム追加
  - [x] /api/stamps/manual に amount カラム追加
- [x] ドキュメント整備
  - [x] 20_家族ひもづけ仕様検討.md 更新（Phase1完了を反映）
  - [x] 21_家族ひもづけ機能_管理ダッシュボード仕様書.md 更新
  - [x] 05_Database_Schema.md 更新（visit_count, amount カラム追加）
  - [x] 03_機能仕様書.md 更新（改訂履歴）
  - [x] 10_TODO.md 更新（本項目）

**注意:**
- 現時点では既存データの×10処理は未実施（開発環境のため）
- 表示ロジックは10倍システムに対応済み
- 本番環境では `UPDATE profiles SET stamp_count = stamp_count * 10;` が必要

---

## 進行中タスク 🚧

現在進行中のタスクはありません。

---

## 未実装機能・今後の開発予定 📋

### Phase 1: バックエンド基盤構築 🔧
- [x] Supabaseプロジェクトセットアップ
  - [x] データベース設計（アプローチ1: シンプル設計）
  - [x] テーブル作成（profiles テーブル）
  - [x] Row Level Security (RLS) 設定
  - [x] Supabase Client統合 (lib/supabase.ts)
- [x] 認証連携
  - [x] LINE LIFF userId と Supabaseユーザーの紐付け
  - [x] ユーザー登録フロー実装（自動UPSERT）
- [x] スタンプ数表示機能
  - [x] Supabaseから stamp_count を取得
  - [x] リアルタイム表示（useState使用）
  - [x] ログイン時の自動データ同期

### Phase 2: スタンプ機能の完全実装 🎯 ✅ 完了（2026-02-09）
- [x] スタンプページ（`/stamp`）実装
  - [x] スタンプ一覧表示（カード型デザイン）
  - [x] 来院履歴表示
  - [x] スタンプカウンター
- [x] QRコード読み取り後のバックエンド連携
  - [x] 来院スタンプ登録API実装（POST /api/stamps）
  - [x] 重複チェック（同日の二重登録防止）
  - [x] リアルタイム更新
- [x] スタンプ履歴管理
  - [x] 来院日時記録（stamp_historyテーブル）
  - [x] データ統一アーキテクチャ確立（Single Source of Truth）
  - ~~カレンダービュー表示~~（実装不要：ユーザー要件により）

### Phase 2.5: 特典交換システム実装 🎁 ✅ 完了（2026-02-09）
- [x] データベース拡張
  - [x] rewardsテーブル作成（特典マスター）
  - [x] reward_exchangesテーブル作成（交換履歴）
  - [x] 初期データ投入（サンプル特典4種類）
- [x] 特典関連API実装
  - [x] 特典一覧取得API（GET /api/rewards）
  - [x] 特典交換API（POST /api/rewards/exchange）
  - [x] スタンプ積み上げ式システム実装（交換後もスタンプは減らない）
- [x] 特典ページ実装（`/rewards`）
  - [x] 現在のスタンプ数表示
  - [x] 特典一覧表示（カード型デザイン）
  - [x] 交換可否の自動判定
  - [x] 交換確認ダイアログ
  - [x] 交換後のリアルタイム更新
- [x] ボトムナビゲーション拡張
  - [x] 4つ → 5つに変更
  - [x] 「特典」メニュー追加
  - [x] UI最適化（タップ領域、アイコンサイズ調整）
- [x] スタッフ手動スタンプ機能強化
  - [x] 2ステップUI実装（認証 → 編集）
  - [x] +/-ボタンでスタンプ数調整
  - [x] 1日1回制限解除（何度でも変更可能）
  - [x] 監査証跡の詳細化
- [x] バージョン管理自動化
  - [x] Gitタグからバージョン自動取得
  - [x] package.json自動更新スクリプト
  - [x] ビルド時の環境変数埋め込み
- [x] ドキュメント整備
  - [x] 特典システム仕様書作成
  - [x] バージョン管理運用ガイド作成
  - [x] 実装サマリー更新

### Phase 3: ケア記録機能 📝
- [ ] ケア記録ページ（`/care`）実装
  - [ ] デイリーチェックリスト
    - [ ] フロス実施チェック
    - [ ] マウスウォッシュチェック
    - [ ] 歯磨き時間記録
  - [ ] セルフケアカレンダー表示
  - [ ] ケア習慣の可視化（グラフ・統計）
- [ ] ケアログ保存API実装
- [ ] ハブラーシカからの励ましメッセージ機能

### ~~Phase 4: ごほうび・ポイント機能~~ 🎁 ✅ Phase 2.5で実装完了（2026-02-09）
- [x] ~~ポイントシステム実装~~ → スタンプシステムとして実装完了
  - [x] 来院スタンプポイント付与 → stamp_historyテーブルで管理
  - [x] ポイント累計計算 → profiles.stamp_countで管理
  - [-] セルフケアポイント付与 → Phase 3（ケア記録機能）と統合予定
- [x] ごほうび交換機能
  - [x] 交換可能特典一覧表示 → 特典ページ実装済み
  - [x] 特典交換フロー → スタンプ積み上げ式で実装済み
  - [x] 交換履歴管理 → reward_exchangesテーブルで記録
- [x] 特典内容 → rewardsテーブルで管理可能
  - [x] ホワイトニング割引クーポン → サンプルデータに含まれる
  - [x] デンタルケア用品引換券 → 歯ブラシセットとして実装
  - [-] 優先予約権 → Phase 8（予約システム統合）と連携予定

### Phase 4.5: 特典システム拡張（オプション・将来実装）
- [ ] 特典画像のアップロード機能
- [ ] 在庫管理機能
- [ ] ユーザー側の交換履歴ページ
- [ ] 特典有効期限設定
- [ ] 交換可能通知（プッシュ通知）
- [ ] セルフケアポイントとの統合

### Phase 5: 医院情報機能 🏥
- [ ] 医院情報ページ（`/info`）実装
  - [ ] 診療時間・アクセス情報
  - [ ] 休診日カレンダー
  - [ ] スタッフ紹介
  - [ ] お知らせ一覧
- [ ] CMSまたは管理画面からの情報更新機能

### Phase 6: LINE Messaging API連携 💬

#### 6-1. LINE Bot基本設定
- [ ] LINE Bot設定
  - [ ] Messaging API統合
  - [ ] Channel Access Token取得
  - [ ] Webhook URL設定
  - [ ] リッチメニュー設定（ミニアプリへの導線）

#### 6-2. 即時レスポンス（自動返信）
- [ ] QRスキャン時の即時通知
  - [ ] サーバー（Cloud Functions/Vercel Serverless Functions）経由でLINEにメッセージ送信
  - [ ] 「スタンプGET！お疲れ様でした！」メッセージ
  - [ ] ハブラーシカのイラスト付きFlex Message実装

#### 6-3. 予約配信・リマインド機能
- [ ] 定期検診リマインド（3ヶ月後自動通知）
  - [ ] バッチ処理実装（毎日1回実行）
  - [ ] 「前回来院から3ヶ月経過した患者」を自動抽出
  - [ ] 「そろそろ検診の時期です」メッセージ送信
- [ ] 次回予約のリマインド
  - [ ] 予約日の1週間前に自動通知
  - [ ] 予約確認・変更ボタン付きメッセージ
- [ ] ケア用品補充時期の通知
  - [ ] 購入履歴から使い終わり時期を推定
  - [ ] 「そろそろ補充しませんか？」メッセージ

#### 6-4. Flex Messageデザイン実装
- [ ] ハブラーシカ画像付きカード型メッセージ
- [ ] 予約ボタン・確認ボタン付きインタラクティブメッセージ
- [ ] リマインドメッセージテンプレート作成
  - [ ] 検診リマインドテンプレート
  - [ ] 予約確認テンプレート
  - [ ] ケア用品補充テンプレート
  - [ ] ごほうび交換可能通知テンプレート

#### 6-5. パーソナライズドメッセージ
- [ ] ハブラーシカからの励ましメッセージ配信
- [ ] ケア記録に基づくアドバイスメッセージ
- [ ] スタンプ達成お祝いメッセージ

### Phase 7: 運用側管理ダッシュボード 👨‍⚕️

#### 7-1. 管理画面プロジェクトセットアップ
- [ ] 別URL（admin.vercel.app等）での管理サイト構築
  - [ ] Next.js プロジェクト作成（患者用とは別リポジトリ推奨）
  - [ ] PC向けレスポンシブデザイン
  - [ ] Tailwind CSS設定

#### 7-2. 認証システム（管理者専用）
- [ ] 管理者認証実装
  - [ ] Googleログイン（理事長・スタッフ用）
  - [ ] メールパスワード認証（Supabase/Firebase Auth）
  - [ ] 権限管理（理事長・受付スタッフ・閲覧のみ等）

#### 7-3. 患者管理機能
- [ ] 患者一覧画面
  - [ ] 登録患者の名前、診察券番号、最終来院日を表示
  - [ ] 検索・フィルター機能（名前、診察券番号）
  - [ ] ソート機能（最終来院日順、登録日順）
  - [ ] ページネーション
- [ ] 患者詳細画面
  - [ ] 基本情報表示
  - [ ] 来院履歴タイムライン
  - [ ] ケア記録の閲覧
  - [ ] スタンプ獲得状況

#### 7-4. スタンプ管理機能
- [ ] スタンプ手動操作
  - [ ] 特定患者のスタンプを手動で増減
  - [ ] 「QRが読めなかった時」の手動付与機能
  - [ ] スタンプ削除・修正機能（誤操作時）
- [ ] QRコード発行機能
  - [ ] 受付用「スタンプ付与QR」の生成
  - [ ] QRコード印刷機能
  - [ ] QR有効期限設定

#### 7-5. 統計・分析機能
- [ ] ダッシュボードトップ画面
  - [ ] 今月の総来院数（グラフ表示）
  - [ ] アクティブユーザー数（習慣ログをつけている人数）
  - [ ] 新規登録者数の推移
  - [ ] スタンプ達成率の分析
- [ ] レポート機能
  - [ ] 月次レポート自動生成
  - [ ] CSV/Excel エクスポート
  - [ ] 来院頻度の分析（リコール率計算）

#### 7-6. 通知管理機能
- [ ] メッセージ配信管理
  - [ ] 一斉配信メッセージ作成
  - [ ] 配信履歴の確認
  - [ ] 個別メッセージ送信機能
- [ ] リマインド設定
  - [ ] リマインドの有効/無効切り替え
  - [ ] リマインドタイミング調整

#### 7-7. お知らせ・コンテンツ管理
- [ ] お知らせ投稿機能
  - [ ] 医院情報ページへの投稿
  - [ ] 休診日の登録
  - [ ] イベント情報の掲載
- [ ] ごほうび特典管理
  - [ ] 特典内容の追加・編集・削除
  - [ ] 交換ポイント数の設定
  - [ ] 在庫管理

> **💡 進め方のアドバイス**
> 最初は立派なダッシュボードを作らず、**Supabase/Firebaseの管理画面をそのまま見る**だけでも運用可能です。
> まずは患者側ミニアプリを優先し、必要になったタイミングで段階的に実装しましょう。

### Phase 8: 高度な機能（患者側） 🚀
- [ ] 予約システム統合
  - [ ] 空き状況確認
  - [ ] オンライン予約機能
  - [ ] 予約変更・キャンセル
- [ ] 診療履歴閲覧
  - [ ] 治療内容の記録
  - [ ] レントゲン画像閲覧（要セキュリティ対策）
- [ ] AIによる口腔ケアアドバイス
  - [ ] ケア記録に基づく改善提案
  - [ ] ハブラーシカによるパーソナルガイド強化

### Phase 9: 運用・最適化 ⚡
- [ ] パフォーマンス最適化
  - [ ] 画像最適化
  - [ ] コード分割
  - [ ] キャッシング戦略
- [ ] アクセシビリティ改善
- [ ] PWA対応（オフライン機能）
- [ ] アナリティクス導入
  - [ ] ユーザー行動分析
  - [ ] 機能利用率測定
- [ ] エラー監視（Sentry等）
- [ ] 本番環境デプロイ
  - [ ] Vercelデプロイ設定
  - [ ] カスタムドメイン設定
  - [ ] 環境変数管理

---

## 技術的な改善タスク 🔨

### コード品質
- [ ] TypeScript型定義の強化
- [ ] エラーハンドリングの統一
- [ ] ローディング状態の改善
- [ ] ユニットテスト導入（Jest）
- [ ] E2Eテスト導入（Playwright）

### UI/UXデザイン
- [ ] Lucide Reactアイコンの最適化
- [ ] アニメーション追加（Framer Motion検討）
- [ ] ダークモード対応
- [ ] レスポンシブデザインの最終調整
- [ ] スケルトンローディングの実装

### セキュリティ
- [ ] 環境変数の適切な管理
- [ ] APIエンドポイントの認証・認可
- [ ] XSS・CSRF対策
- [ ] データバリデーション強化

---

## メモ・備考 📌

### 設定が必要な環境変数

#### 患者用ミニアプリ（`.env.local`）
```env
# LINE LIFF設定
NEXT_PUBLIC_LIFF_ID=your-liff-id

# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# スタッフ手動スタンプ用暗証番号
NEXT_PUBLIC_STAFF_PIN=1234

# アプリバージョン情報（Gitタグから自動取得、上書き可能）
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_BUILD_DATE=
NEXT_PUBLIC_GIT_COMMIT=

# LINE Messaging API（サーバーサイド用）
LINE_CHANNEL_ACCESS_TOKEN=your-line-bot-token
LINE_CHANNEL_SECRET=your-line-channel-secret

# QRコード認証用
QR_STAMP_SECRET=your-qr-secret-key
```

#### 管理ダッシュボード（`.env.local`）
```env
# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# 認証設定
NEXTAUTH_URL=https://admin.yourdomain.com
NEXTAUTH_SECRET=your-nextauth-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=your-line-bot-token
LINE_CHANNEL_SECRET=your-line-channel-secret
```

### 参考リソース
- [LINE LIFF Documentation](https://developers.line.biz/ja/docs/liff/)
- [LINE Messaging API Documentation](https://developers.line.biz/ja/docs/messaging-api/)
- [LINE Flex Message Simulator](https://developers.line.biz/flex-simulator/)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js 16 Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [NextAuth.js Documentation](https://next-auth.js.org/)

---

## 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-02-08 | 初版作成 |
| 2026-02-08 | Phase 6（LINE Messaging API連携）を詳細化：即時レスポンス、予約配信・リマインド機能、Flex Message実装を追加 |
| 2026-02-08 | Phase 7（運用側管理ダッシュボード）を新設：患者管理、スタンプ管理、統計・分析、通知管理等の7セクション追加 |
| 2026-02-08 | 環境変数セクションを拡充：患者用・管理用の環境変数を分離、参考リソースにMessaging API関連を追加 |
| 2026-02-08 | Phase 1完了マーク：Supabase連携、スタンプ数表示機能を完了済みタスクに追加 |
| 2026-02-08 | 最終アクセス日時（updated_at）と診察券番号（ticket_number）の表示機能を追加 |
| 2026-02-09 | Phase 2完了マーク：スタンプ機能完全実装（スタンプページ、API、履歴管理、データ統一アーキテクチャ） |
| 2026-02-09 | **重要な仕様変更**: スタンプ消費型 → 積み上げ式に変更、特典内容詳細化（価格・有効期限・詳細説明追加）、仕様変更履歴ドキュメント作成 |
| 2026-02-09 | Phase 2.5完了マーク：特典交換システム実装（rewardsテーブル、特典ページ、ボトムナビ5つ化、スタッフ機能強化、バージョン管理自動化） |
| 2026-02-09 | Phase 4更新：Phase 2.5で実質的に完了、Phase 4.5（拡張機能）を新設 |
| 2026-02-14 | 予約システム連携：診察券番号コピー機能、アポツール予約ボタン実装、診察券タブUIデザイン改善（メイン/サブボタンの洗練、余白調整） |
| 2026-02-14 | 開発環境整備：ngrok導入（v3.36.1）、lucide-react最新版アップデート（0.564.0）、TypeScript型定義エラー解消 |
| 2026-02-14 | 次回メモ機能実装：データベース拡張（3カラム追加、自動更新トリガー）、API実装（GET/PUT）、患者側表示、管理画面作成、タイムゾーン問題修正 |
| 2026-02-14 | 予約ボタンクリック数トラッキング機能実装：データベース拡張（reservation_button_clicks カラム追加、increment_reservation_clicks() 関数）、API実装（POST /api/users/[userId]/reservation-click）、フロントエンド実装（非同期fetch、エラー握りつぶし） |
