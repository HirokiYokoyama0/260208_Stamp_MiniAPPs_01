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

### Phase 4: ごほうび・ポイント機能 🎁
- [ ] ポイントシステム実装
  - [ ] 来院スタンプポイント付与
  - [ ] セルフケアポイント付与
  - [ ] ポイント累計計算
- [ ] ごほうび交換機能
  - [ ] 交換可能特典一覧表示
  - [ ] 特典交換フロー
  - [ ] 交換履歴管理
- [ ] 特典内容
  - [ ] ホワイトニング割引クーポン
  - [ ] デンタルケア用品引換券
  - [ ] 優先予約権

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
