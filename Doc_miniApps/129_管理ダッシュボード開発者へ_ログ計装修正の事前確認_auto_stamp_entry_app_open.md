# 管理ダッシュボード開発者へ — ログ計装修正の事前確認（auto_stamp_entry／app_open）

**作成日**: 2026-09-26
**送信元**: LIFFアプリ開発側
**対象**: 管理ダッシュボード開発者
**種別**: 事前確認・調整（コード修正の前段階）
**関連**: [125_管理ダッシュボード開発者へ_新イベントログ連携.md](125_管理ダッシュボード開発者へ_新イベントログ連携.md)（イベント計装の正本） / [60_イベントログ設計.md](60_イベントログ設計.md) / [124_コードベース棚卸し_実態調査レポート.md](124_コードベース棚卸し_実態調査レポート.md)

---

## 0. 要旨

先日いただいた **確認依頼4点（①〜④）** を、LIFF側の実コードで調査しました。結論は以下です。

| # | 相手の指摘 | 調査結論 | 対応区分 |
|---|-----------|---------|---------|
| ① | 第1段階(着地)が9件中2件しか出ない | **単段着地は正常経路**。ログ漏れとは限らない（ただし第1段階はfire-and-forgetで取りこぼし余地あり） | ダッシュボード側の**検知ロジック調整**を依頼 |
| ② | `auto_stamp_entry` が stamp 無しの起動でも発火 | **LIFF側の実装バグ**（発火条件が緩い） | 🔧 **LIFF側コード修正**（本書で事前確認） |
| ③ | 重複スキャンの短時間リトライ | **自動リトライは無い**（ユーザーの手動再読取）。付与済みUIは有り | 情報共有＋任意のUX改善 |
| ④ | `app_open` が同一セッションで多重発火 | **タブ遷移では発火しない**。フルロード/再init毎に発火 | 🔧 **LIFF側コード修正**（本書で事前確認） |

**②と④はLIFF側でコードを直します**。ただしこの2つは **`event_logs` に流れるデータの形・件数を変える**＝ダッシュボードの集計に影響します。デプロイ前に、以下の影響と移行方針を確認・合意させてください。

> 相手の**補足（相関キーの要望）**にも回答します（§5）。④のセッション概念と統合して、`session_id` を導入する案を提示します。

---

## 0.1 承認・実装状況（2026-09-26 更新）

- **管理ダッシュボード側：全項目承認済み**（回答は §7）。安全性の核心＝「②④はログ計装(観測)のみで、スタンプ/特典の**付与ロジックには一切触れない**」ことをダッシュボード側もコードで確認済み（event_logs消費箇所・DAU算出・障害検知いずれも app_open 件数／auto_stamp_entry に非依存）。
- **LIFF側：実装完了（未デプロイ）**。変更内容は §9、デプロイ前の残作業（実機確認・カットオーバー記録）は §10。`tsc --noEmit` / `next build` 通過。

---

## 1. 4問への回答（詳細）

### ① 第1段階(着地)が少ない → 単段着地は正常

- 発火元：[app/page.tsx](../app/page.tsx#L53) の `if (rawQuery)` → [lib/analytics.ts `logAutoStampEntry`](../lib/analytics.ts#L270)。
- `from_liff_state=true`（第1段階）になるのは、**LINEが `?liff.state=%3Faction%3Dstamp...` のエンコード形式で着地させた時だけ**。展開済みURL（`?action=stamp&...`）で着地する経路（＝単段）では第1段階は物理的に存在せず、**第2段階1件のみが正常**です。どちらの配信になるかはLINE/端末/LIFFバージョン依存で、当方は受け取ったものを記録しているだけ。
- したがって「9件中2件だけ第1段階」は、**多くが単段配信だった**ことを示すもので、当方のログ送信漏れとは限りません。
- 正直な補足：第1段階のログは **fire-and-forget（awaitしない）anon insert** で、直後にLIFF SDKが `liff.state` を展開して**フルナビゲーション**するため、送信中のリクエストが中断されて欠落し得ます（2段階で来ても第1段階が残らない余地あり）。

> **依頼**：障害検知（125 §No.70）は**第1段階の有無に依存させず**、「第2段階 `redirected=true` の有無」＋ `auto_stamp_result` の `api_success` の有無を主軸にしてください。第1段階は補助情報に。

### ② stamp無しの起動でも発火 → 本書の主題（§2へ）

### ③ 短時間リトライ → 自動リトライ無し・UIは有り

- **アプリの自動リトライはコード上存在しません**。カメラQR（[app/auto-stamp/page.tsx](../app/auto-stamp/page.tsx#L18)）は useEffect で1回だけ処理。/scan（[app/scan/page.tsx](../app/scan/page.tsx)）はボタン手動タップ式。
- **「付与済み」明示表示は有り**：409/alreadyReceived 時に専用画面「⚠️ 既に受け取り済み／本日は既にQRコードでスタンプを受け取っています／1日1回まで」を表示（[app/auto-stamp/page.tsx](../app/auto-stamp/page.tsx#L173)）。
- `stamp_scan_fail(duplicate_scan/409)` は**サーバー側**が出力（[app/api/stamps/auto/route.ts](../app/api/stamps/auto/route.ts#L79)）。サーバーが正しく弾いた記録＝二重付与なし。
- **6393の4秒4連発は、ユーザーが物理QRを4回読み直したもの**。推定原因はコールドスタート/多段遷移の待ち時間（124 §7.4「応答遅延6-9s」）中に、結果画面が出る前にユーザーが再スキャンしたフィードバック遅延。付与の安全性は問題なし。UX改善は任意（結果表示の体感高速化／ローディング文言強化／クライアント側の数秒重複ガード）。

### ④ app_open 多重発火 → 本書の主題（§3へ）

---

## 2. 【要確認】② `auto_stamp_entry` の発火条件を絞る

### 2.1 現状（バグ）

[app/page.tsx](../app/page.tsx#L53) が **`if (rawQuery)`**（＝空でないクエリなら全部発火）になっており、125に書いた「action=stampの時だけ発火」と食い違っています。このため以下まで拾っています：

- `?liff.state=/settings`（設定を開いただけ）
- `?liff.state=/rewards`（特典を開いただけ）
- `?state=...&liffClientId=...`（LINEログイン/state）
- `?...&friendship_status_changed=...`（友だち追加系）

### 2.2 修正後の挙動

発火条件を **「action=stamp（`liff.state` 内の補完値を含む）かつ type=qr/purchase」** に限定します。

```ts
// 現状: if (rawQuery)
const isStampEntry = effAction === 'stamp' && (effType === 'qr' || effType === 'purchase');
if (rawQuery && isStampEntry) {
  void logAutoStampEntry({ ... });
}
```

`effAction` は `liff.state` デコード後の補完値なので、**第1段階（stampの着地）と第2段階は残し、stamp無しの起動は除外**できます。

| 起動パターン | 修正前 | 修正後 |
|-------------|-------|-------|
| `?action=stamp&type=qr&amount=15...`（展開済み・第2段階） | 発火 | **発火（維持）** ✅ |
| `?liff.state=%3Faction%3Dstamp...`（第1段階） | 発火 | **発火（維持）** ✅ |
| `?liff.state=/settings`・`/rewards` | 発火 | **発火しない** ❌ |
| `?state=...&liffClientId` / friendship系 | 発火 | **発火しない** ❌ |

### 2.3 ダッシュボードへの影響と確認事項

- **今後のデータ**：`auto_stamp_entry` は「スタンプQR関連の着地」だけになります（settings/rewards/login/friendship では出なくなる）。
- **過去のデータ**：既に混在済み。**修正しても過去分は消えません**。→ ダッシュボード側で「`action` が null または stamp 以外の `auto_stamp_entry` は『LIFF起動/画面遷移』扱い」で振り分けると、過去分もきれいになります（**両面対応が理想**）。
- **代替案**：もしダッシュボードが「一般起動/画面遷移」の把握に `auto_stamp_entry` を利用していた場合、修正で取れなくなります。その用途は `app_open`（＋将来的に `page_view`）に寄せるのが適切です。必要なら別イベント名での計装も検討します。

> **確認A-1**：発火条件を上記に絞って問題ないか（ダッシュボードの集計・ラベル・凡例で `action=null` の `auto_stamp_entry` に依存している箇所はないか）。
> **確認A-2**：過去データのノイズは**ダッシュボード側でフィルタ**する前提でよいか。
> **確認A-3**：「一般起動/画面遷移」把握のための別ラベル・別イベントが必要か。

---

## 3. 【要確認】④ `app_open` の多重発火を是正

### 3.1 現状（多重発火の仕組み）

- [app/layout.tsx](../app/layout.tsx#L18) が全ルートを `AppLayout` で包み、app_open は [components/layout/AppLayout.tsx](../components/layout/AppLayout.tsx#L219) の `if (isLoggedIn && profile) logAppOpen()` で発火。
- **SPA内のタブ切替では AppLayout が維持され、`isLoggedIn`/`profile` が不変 → 再発火しません**。
- しかし**フルドキュメントロード（別init）毎に** `useLiff` が再init → profile再セット → app_open発火。カメラQR経路は複数のフルロードを伴う（liff.state着地 → SDK展開でlocation書き換え → /auto-stamp）。**referrer が null と vercel.app 混在**なのは、別ロードが複数回起きた証拠です（例：7868の14秒3回）。

### 3.2 修正方針（案）

**app_open を「LIFFセッションで1回」に絞る**。`sessionStorage` にフラグを持ち、同一セッション（＝同一webviewの一連のフルロード）内では2回目以降を送らない。

```ts
// AppLayout の app_open 発火をガード（案）
useEffect(() => {
  if (isLoggedIn && profile && !sessionStorage.getItem('app_open_sent')) {
    sessionStorage.setItem('app_open_sent', '1');
    logAppOpen({ userId: profile.userId, metadata: { session_id: getSessionId() } });
  }
}, [isLoggedIn, profile]);
```

- `sessionStorage` は**同一webview内のフルリロードをまたいで保持**されるため、camera-QRの多段ロードを1回に集約できます。
- 逆に、LINEが**別webviewで開き直した場合はフラグも無い**ので「本当に新しい起動」は正しく1回カウントされます（過剰抑制にならない）。
- ⚠️ 検証事項：LIFFの `liff.state` 展開が**同一ブラウジングコンテキスト内の遷移**であること（＝sessionStorageが保持される）を実機で確認してからデプロイします。

### 3.3 ダッシュボードへの影響と確認事項

- **app_openの件数が減ります**（水増しの是正）。→ **DAU/起動数の指標が下がり、過去との連続性に段差**が出ます。
- ダッシュボード側で**既にdedupしている場合**、二重にdedupすると過小になり得ます。粒度のすり合わせが必要です。

> **確認B-1**：app_openの件数が下がる（是正）ことを許容できるか。過去比較のため**カットオーバー日時**を記録します（§4）。
> **確認B-2**：「セッション」の粒度は **LIFF起動（webview）単位＝フルロードをまたいで1回** で合意でよいか。
> **確認B-3**：ダッシュボード側で現在 app_open を dedup しているか。している場合、その定義（時間窓／user_id単位など）を教えてください（二重dedup回避のため）。
> **確認B-4**：画面遷移の把握が別途必要なら、`page_view` 等の別イベントを新設するか（app_openとは分離）。

---

## 4. カットオーバー／移行方針の提案

②④はデータの形・件数を変えるため、**切替日時を明示**して、ダッシュボードが before/after で集計ロジックを切り替えられるようにします。

- デプロイ確定後、本書の改訂履歴に **`YYYY-MM-DD HH:MM (JST) デプロイ` を追記**します。
- ダッシュボードは「その日時以降の `auto_stamp_entry`／`app_open`」を新ルールで解釈してください。
- ①（検知ロジックの第1段階非依存化）も、この機に合わせて調整いただけると整合します。

---

## 5. 【提案】`session_id` の導入（相手の相関キー要望への回答）

いただいた補足：
> 「カメラQR着地の user_id が空欄。将来的に相関キー（セッションID等）があると分析精度が上がる（要望レベル）」

これは **④のセッション概念とそのまま統合できます**。クライアント側で**LIFFセッション毎に1つの `session_id`** を生成（`sessionStorage`）し、以下のイベントの `metadata` に付与する案です。

| 付与先イベント | 効果 |
|--------------|------|
| `app_open` | ④のdedupキー兼、セッションの起点 |
| `auto_stamp_entry`（user_id=null でも） | **user_id無しの第1段階を、同一セッションの他イベント（user_id有り）と突合可能に** |
| `auto_stamp_result` | 着地→結末を session_id で1本に繋げられる |

これにより、①で課題になっていた「user_id を持たない着地イベントの紐付け」が **session_id 経由で可能**になります（`created_at` 時系列突合より高精度）。

> **確認C-1**：`session_id`（例：`sess_<乱数>` 形式の文字列、`metadata.session_id`）を上記イベントに付与する方針でよいか。
> **確認C-2**：ダッシュボード側で session_id を使った突合・可視化を行うか（フィールド名・形式の希望があれば指定してください）。

---

## 6. ①③の扱い（コード修正なし／依頼・情報共有）

- **①**：ダッシュボード側で**検知ロジックを第1段階非依存**に（§1①・§4）。
- **③**：情報共有のみ。自動リトライ無し・付与済みUI有り・二重付与なし。UX改善（体感速度／重複ガード）は任意で、必要になれば別タスク化します。

---

## 7. 確認事項への回答（管理ダッシュボード側・2026-09-26 確定）

| # | 項目 | 回答 | 備考 |
|---|------|------|------|
| A-1 | auto_stamp_entry を action=stamp に絞る | ✅ 承認 | action=null着地は表示上のノイズ・依存なし |
| A-2 | 過去ノイズはダッシュボード側フィルタ前提 | ✅ OK | 「action無し=LIFF起動/画面遷移」で振り分け |
| A-3 | 一般起動用の別ラベル/別イベント要否 | ❌ 不要 | app_openで足りる |
| B-1 | app_open件数が下がるのを許容 | ✅ 許容 | DAUは `profiles.updated_at` 由来＝非依存 |
| B-2 | セッション粒度=webview/フルロード単位 | ✅ 合意 | |
| B-3 | ダッシュボードは app_open を dedup しているか | ❌ していない | 二重dedupの心配なし |
| B-4 | page_view の新設要否 | ⭕ 任意（今は不要） | 遷移分析が必要になった時 |
| C-1 | session_id を3イベントに付与 | ✅ 承認 | metadata追加は後方互換 |
| C-2 | session_id で突合・可視化するか | ✅ やりたい | 形式：`sess_<乱数>`・webview内で不変。可能なら stamp_scan_success/fail にも付与希望（→ §9 で対応） |

**承認条件**：④の sessionStorage 取りこぼし対策として、(a) 実機で `liff.state` 展開をまたいだ保持を確認、(b) app_open は keepalive/sendBeacon で中断に強くする（いずれも §9・§10 で対応）。**カットオーバー日時の記録は必須**。

---

## 8. 次アクション（LIFF側）

上記の合意後、以下を**最小差分・ハッピーパス非破壊**で実装します。

1. ② [app/page.tsx](../app/page.tsx) の発火条件を `isStampEntry` に限定
2. ④ [components/layout/AppLayout.tsx](../components/layout/AppLayout.tsx) の app_open を sessionStorage で1回に
3. （C合意時）`session_id` を [lib/analytics.ts](../lib/analytics.ts) 経由で該当イベントに付与
4. 実機検証（liff.state展開でsessionStorageが保持されること）→ 本番デプロイ → 本書にカットオーバー日時を追記

---

## 9. 実装完了（2026-09-26・未デプロイ）

すべて**ログ計装のみ**。スタンプ/特典の付与ロジック・RLS・トリガー・visit_count には非干渉。`tsc --noEmit` と `next build` 通過確認済み。

| # | ファイル | 変更内容 |
|---|---------|---------|
| ② | [app/page.tsx](../app/page.tsx) | `auto_stamp_entry` の発火を `isStampEntry`（`effAction==='stamp' && effType∈{qr,purchase}`）に限定。settings/rewards/login/friendship では発火しない。第1段階(stamp着地)・第2段階は維持 |
| ④ | [components/layout/AppLayout.tsx](../components/layout/AppLayout.tsx) | `app_open` を sessionStorage フラグ `app_open_sent` で**セッション1回**に。sessionStorage不可時はガードせず送信（計上優先） |
| ④条件b | [lib/analytics.ts](../lib/analytics.ts) | `logEvent` に `keepalive` 対応を追加。`app_open`/`auto_stamp_entry`/`auto_stamp_result` を **keepalive fetch**（REST直叩き）で送信し、`liff.state`展開/遷移中の中断で落とさない。失敗時は従来の supabase-js 経路にフォールバック |
| C | [lib/analytics.ts](../lib/analytics.ts) | `getSessionId()` を追加（`sess_<乱数>`・sessionStorage保持・webviewセッション内で不変）。全**クライアント発**イベントの `metadata.session_id` に自動付与 |
| C-2 | [app/auto-stamp/page.tsx](../app/auto-stamp/page.tsx) → [app/api/stamps/auto/route.ts](../app/api/stamps/auto/route.ts) | クライアントが `sessionId` をAPIに渡し、**サーバー発**の `stamp_scan_success`/`stamp_scan_fail`（409/429）にも `session_id` を付与。**着地(auto_stamp_entry)→結末(auto_stamp_result)→付与(stamp_scan_success)** が同一 session_id で1本に追える |

**session_id の網羅範囲**：クライアント発は `logEvent` で全イベント自動付与。サーバー発は現状**カメラQR経路（`/api/stamps/auto`）のみ**スレッド済み。`/api/stamps/scan`・`/api/stamps`（＝アプリ内スキャン。[123](123_アプリ内スキャン機能_一時無効化.md) で一時無効化中）のサーバー発ログは未スレッド＝必要になれば追補（任意）。

## 10. デプロイ前の残作業（必須）

ダッシュボード側の承認条件に対応。

1. **実機確認（ゲート）**：iPhone/Android実機で、カメラQR→`liff.state`展開のフルナビゲーションを**またいで sessionStorage が保持される**こと（＝`app_open` が1回・`session_id` が着地〜付与で不変）を確認してからデプロイ。保持されない環境が判明した場合でも、`app_open` は sessionStorage 例外時に従来どおり計上（フォールバック済み）。
2. **カットオーバー日時の記録**：本番デプロイ後、本書 §4 と下記改訂履歴に `YYYY-MM-DD HH:MM (JST)` を追記。ダッシュボードはこの日時以降を新ルールで解釈。
3. **①検知ロジック**：ダッシュボード側で「第2段階(`redirected=true`)＋`auto_stamp_result` 主軸／第1段階非依存」へ調整（LIFF側の keepalive 化で第1段階の取りこぼしも軽減済み）。

---

## 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-09-26 | 初版作成（②④のコード修正に関する事前確認。①③の回答、session_id提案を含む） |
| 2026-09-26 | ダッシュボード全項目承認 → LIFF側実装完了（②発火条件・④once-per-session＋keepalive・C session_id）。`tsc`/`next build` 通過。デプロイ前の実機確認・カットオーバー記録が残作業（§9/§10） |
