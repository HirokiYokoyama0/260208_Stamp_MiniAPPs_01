# 実装サマリー

各日の実装内容を時系列で記録。新しい作業はこのファイルの末尾に追記する。

---

## 2026-02-08: Phase 1 バックエンド基盤構築

### Supabase連携実装
- @supabase/supabase-js インストール、lib/supabase.ts 作成
- .env.local に SUPABASE_URL, SUPABASE_ANON_KEY 設定

### データベース設計
- profilesテーブル作成（001_create_profiles_table.sql）
- id を TEXT型（LINEユーザーID直接格納）で設計
- RLS設定、インデックス作成

### ユーザー情報の自動保存
- LINEログイン時に profiles へ UPSERT（id, line_user_id, display_name, picture_url）
- updated_at を自動更新

### 画面表示機能
- スタンプ数（stamp_count）のリアルタイム表示
- 診察券番号（ticket_number）表示（未登録時は「未登録」）
- 最終アクセス日時（updated_at）を日本語フォーマットで表示

### セキュリティ対応
- Next.js 15.1.0 → 16.1.6（CVE-2025-66478 脆弱性対応）
- React 19.0.0 → 19.2.4
- .gitignore に .claude, .env.local 追加

---

## 2026-02-09: Phase 2 スタンプ機能 + Phase 2.5 特典交換システム

### データベース拡張

**stamp_historyテーブル（002_create_stamp_history_table.sql）:**
- 1ユーザー:N個のスタンプ（1:N関係）
- QRコードIDで重複防止
- トリガー関数 `update_profile_stamp_count()` で profiles.stamp_count を自動計算

**rewards / reward_exchangesテーブル（003_create_rewards_tables.sql）:**
- rewards: 特典マスター（歯ブラシセット5個、フッ素塗布10個、クリーニング半額15個、ホワイトニング30%OFF 20個）
- reward_exchanges: 交換履歴（status: pending/completed/cancelled）

### データアーキテクチャ: Single Source of Truth
- profiles.stamp_count がスタンプ数の唯一の真実
- stamp_history INSERT → トリガー → profiles.stamp_count 自動更新
- 診察券ページとスタンプページでデータ不整合なし

### スタンプ登録API
- POST /api/stamps: QRスキャン → stamp_history INSERT → 重複チェック（同日同QR）
- lib/stamps.ts: fetchStampCount, fetchStampHistory, addStamp 等
- types/stamp.ts: StampHistoryRecord, AddStampResponse, StampProgress

### スタンプページ完全実装（app/stamp/page.tsx）
- スタンプカウンター、プログレスバー、来院履歴リスト、QRスキャン

### 特典交換システム
- GET /api/rewards: 有効な特典一覧取得
- POST /api/rewards/exchange: スタンプ積み上げ式（スタンプは減らない）
- app/rewards/page.tsx: 特典一覧、交換可否判定、交換処理
- lib/rewards.ts, types/reward.ts

### ボトムナビゲーション拡張
- 4つ → 5つ（診察券/スタンプ/特典/ケア記録/医院情報）
- アイコン20px、ラベル10px、flex-1でタップ領域均等配分

### スタッフ手動スタンプ機能強化
- 2ステップUI（認証 → 編集）、+/-ボタン
- POST /api/stamps/manual: newStampCount パラメータ追加
- 1日1回制限解除、監査証跡を stamp_history に記録

### バージョン管理自動化
- scripts/update-version.mjs: Gitタグから自動バージョン取得
- next.config.mjs: NEXT_PUBLIC_APP_VERSION として埋め込み
- prebuild フックで package.json を自動更新

### 仕様変更（v1.1）
- スタンプ消費型 → 積み上げ式に変更（2026-02-09）
- 条件を満たせば何度でも特典交換可能

---

## 2026-02-09: LINE友だち登録機能

### データベース
- profiles.is_line_friend カラム追加（004_add_is_line_friend_column.sql）
- BOOLEAN型、デフォルト NULL（未確認）

### 実装
- hooks/useLiff.ts: liff.getFriendship() で友だち状態取得、Supabaseにキャッシュ
- components/features/FriendshipPromptModal.tsx: 友だち登録促進モーダル
- AppLayout.tsx: 初回起動時にモーダル表示（1日1回、2秒遅延）
- AdultInfoPage.tsx: 友だち登録状態に応じた表示切替
- 友だち追加URL: https://line.me/R/ti/p/@550mlcao

---

## 2026-02-11: 子供用モード基盤（Kids Mode Phase 1）

### フォルダ構成リファクタリング
- 既存ページUIを components/(adult)/AdultXxx.tsx に抽出（5ファイル）
- components/(kids)/KidsXxx.tsx をプレースホルダーとして作成（5ファイル）
- QRScanner, StaffPinModal を features/ → shared/ に移動

### ViewModeContext（表示モード管理）
- contexts/ViewModeContext.tsx: adult/kids 切替、Supabase profiles.view_mode と同期
- types/viewMode.ts: ViewMode 型定義
- デフォルト 'adult'、エラー時もクラッシュしない

### ページルーティング変更
- 全5ページを共通パターンに書き換え: useViewMode() → Adult/Kids 分岐

### 設定ページ
- app/settings/page.tsx: 大人用/子供用モード切替ボタン

### Tailwind CSS拡張
- kids カラー5色: kids-pink, kids-yellow, kids-green, kids-blue, kids-purple
- kids フォント: "M PLUS Rounded 1c"

### Supabaseマイグレーション
- 005_add_view_mode_column.sql: profiles.view_mode カラム追加

### 子供用医院情報ページ
- KidsInfoPage.tsx: 全セクションひらがな表記、kidsカラー5色で色分け
- 設定ページへのリンク（モード切替用）

### ハブラーシカ画像
- public/images/haburashika.jpg に配置
- KidsStampPage で使用（120x120）

### 子供用スロットゲームボタン
- components/shared/KidsSlotButton.tsx: 子供モード時のみフローティング表示
- app/slot/page.tsx: プレースホルダー
- ボトムナビ左上に固定配置（bottom-[72px] left-4）

### その他
- 設定ページの alert() 削除
- ファイル構成.md 全面更新

### デプロイ注意
- 推奨順: SQL（005）→ Vercelデプロイ
- 逆順でもクラッシュしないが、設定ページのモード切替が機能しない
