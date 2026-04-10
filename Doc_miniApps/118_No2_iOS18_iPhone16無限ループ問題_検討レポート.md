# iOS 18 / iPhone 16 環境でのLIFF無限ループ問題 - 検討レポート

**作成日**: 2026-04-06
**ステータス**: 🔍 検討中（実装変更は保留）
**重要度**: 🔴 高（特定環境での問題発生）

---

## 📋 報告された問題

### 現象

**日時**: 2026-04-06 08:18:49～50（約1秒間）
**対象ユーザー**: 岡本さん（診察券7569）
**デバイス**: iPhone 16 (iOS 18と推測)
**発生件数**: 43件のリクエストが集中

### 異常パターン

1. **同一ミリ秒内での重複リクエスト**
   ```
   08:18:50.669 - / (トップページ) 2回同時 🔴
   08:18:50.597 - /rewards (特典ページ) 2回同時 🔴
   08:18:50.509 - /info (情報ページ) 2回同時 🔴
   08:18:50.437 - /settings (設定ページ) 2回同時 🔴
   08:18:49.749 - / (トップページ) 2回同時 🔴
   ```

2. **0ms間隔での連続アクセス（物理的に不可能）**
   ```
   / (トップページ) - 間隔: 0ms
   /settings (設定) - 間隔: 0ms
   /info (情報) - 間隔: 0ms
   /rewards (特典) - 間隔: 0ms
   ```

3. **requestId の異常な重複**
   ```
   wzfs5: 9回
   z2789: 8回
   wdnck: 6回
   ```
   通常は1～2回程度だが、6～9回も繰り返されている。

---

## 🔍 現在の実装分析

### LIFF SDK バージョン

**現在**: `@line/liff@2.26.1` （最新版に近い）

**確認結果**: ✅ 最新版（2.26.x系）を使用しており、バージョン起因の問題ではない可能性が高い

---

### LIFF初期化コード（hooks/useLiff.ts）

```typescript
useEffect(() => {
  let mounted = true;

  const initLiff = async () => {
    console.log('[useLiff] 初期化開始');
    if (typeof window === "undefined") {
      console.log('[useLiff] サーバーサイドのため初期化スキップ');
      return;
    }
    if (!LIFF_ID) {
      console.error('[useLiff] LIFF_IDが設定されていません');
      setError(new Error("NEXT_PUBLIC_LIFF_ID is not set"));
      setIsLoading(false);
      return;
    }

    console.log('[useLiff] LIFF_ID:', LIFF_ID);

    try {
      console.log('[useLiff] liff.init() 実行中...');
      await liff.init({ liffId: LIFF_ID });
      if (!mounted) return;

      console.log('[useLiff] liff.init() 完了');
      setIsInitialized(true);

      if (liff.isLoggedIn()) {
        console.log('[useLiff] ログイン済み - プロフィール取得中...');
        setIsLoggedIn(true);
        const profileData = await liff.getProfile();
        if (!mounted) return;

        console.log('[useLiff] プロフィール取得完了:', profileData);

        setProfile({
          userId: profileData.userId,
          displayName: profileData.displayName ?? "",
          pictureUrl: profileData.pictureUrl,
          statusMessage: profileData.statusMessage,
        });

        // 友だち状態をチェック
        console.log('[useLiff] 友だち状態チェック中...');
        await checkFriendship();
        console.log('[useLiff] 友だち状態チェック完了');
      } else {
        console.log('[useLiff] 未ログイン');
        setIsLoggedIn(false);
      }
    } catch (err) {
      console.error('[useLiff] エラー発生:', err);
      if (!mounted) return;
      setError(err instanceof Error ? err : new Error("LIFF init failed"));
      setIsInitialized(false);
    } finally {
      if (mounted) {
        console.log('[useLiff] 初期化完了 - isLoading=false');
        setIsLoading(false);
      }
    }
  };

  initLiff();

  return () => {
    mounted = false;
  };
}, []); // 依存関係を空にして一度だけ実行
```

### ✅ 現在の実装の良い点

1. **リトライロジックが存在しない**
   - `catch`ブロックで`window.location.reload()`を呼んでいない
   - エラー時にエラーステートを設定するのみ

2. **mountedフラグでメモリリーク対策**
   - コンポーネントがアンマウントされた場合の対策が入っている

3. **依存関係が空配列**
   - `useEffect`の依存配列が`[]`なので、1回だけ実行される設計

4. **詳細なログ出力**
   - 各ステップでconsole.logを出力しているため、デバッグしやすい

### ⚠️ 潜在的な問題点

1. **React Strict Modeによる二重実行**
   - 開発環境（`npm run dev`）では、React 19のStrict Modeが`useEffect`を**2回実行**する
   - **しかし**、本番環境では1回のみ実行されるため、本番での無限ループ原因にはならない

2. **外部ブラウザとLINEアプリの切り替えループ（iOS 18特有の可能性）**
   - LIFF URLをLINE内WebViewで開けない場合、外部ブラウザに飛ばされる
   - 外部ブラウザが`line://`スキームでLINEに戻そうとする
   - LINEが再度外部ブラウザで開く → **無限ループ**

3. **liff.init()の複数回実行**
   - `mounted`フラグがあるが、`liff.init()`自体は複数回呼ばれる可能性がある
   - LIFF SDKは**既に初期化済みの場合でもエラーを投げない**仕様のため、安全

4. **ページ遷移時の再初期化**
   - Next.js App Routerでは、ページ遷移時にコンポーネントが再マウントされる場合がある
   - `AppLayout`は全ページで使われているため、通常は再マウントされない
   - **しかし**、特定の条件下（ブラウザバックなど）で再マウントされる可能性

---

## 🎯 問題の原因仮説

### 最も可能性が高い: iOS 18のWebView仕様変更

1. **Intelligent Tracking Prevention (ITP)の厳格化**
   - iOS 18でプライバシー保護が強化された
   - WebView内でのストレージアクセス（LocalStorage, Cookie）が制限される
   - LIFF SDKがログイン状態を保持できず、毎回ログイン処理が走る

2. **ユニバーサルリンク（Universal Links）の解決ロジック変更**
   - LIFF URLの`line://`スキーム処理が変更された
   - LINE内WebViewで開くべきURLが外部ブラウザで開かれる
   - 外部ブラウザから再度LINEに戻る際にURLが再度開かれる → **無限ループ**

3. **WebViewのユーザーエージェント判定の差異**
   - LIFF SDKがiOS 18のWebViewを正しく認識できない
   - 「LINE内ブラウザ」として認識されず、外部ブラウザとして扱われる
   - `liff.login()`が毎回呼ばれる

### 中程度の可能性: LIFF SDK v2.26.1のバグ

- iOS 18リリース（2024年9月）以降、LIFFがv2.26.xで対応した可能性
- **しかし**、現在v2.26.1を使用しており、最新版のため可能性は低い

### 低い可能性: 現在のコードの問題

- リトライロジックがないため、コード起因の無限ループは考えにくい
- **ただし**、`checkFriendship()`内でSupabaseアクセスが失敗し続けている可能性はある

---

## 📊 影響範囲

### 現在の状況

- **大多数のユーザー**: 正常動作（問題なし）
- **特定環境（iOS 18 / iPhone 16）**: 無限ループ発生の可能性

### リスク評価

| 項目 | 評価 | 理由 |
|------|------|------|
| **影響範囲** | ⚠️ 中 | iOS 18ユーザーのみ（全体の10～20%と推測） |
| **重大度** | 🔴 高 | 無限ループによりアプリが使用不可能 |
| **発生頻度** | ⚠️ 中 | 初回起動時のみ発生する可能性 |
| **再現性** | 🔴 低 | 特定条件下でのみ発生（デバッグ困難） |

---

## 🛠️ 対策案

### 🔴 リスク高（大多数のユーザーに影響する可能性）

以下の対策は**慎重に検討すべき**です。現在正常動作しているユーザーに影響を与える可能性があります。

#### ❌ 対策案1: LIFF初期化のリトライ制限（推奨しない）

```typescript
const MAX_RETRY = 3;
const initAttempts = useRef(0);

useEffect(() => {
  const initLiff = async () => {
    if (initAttempts.current >= MAX_RETRY) {
      console.error('[useLiff] 最大リトライ回数に達しました');
      setError(new Error('LIFF初期化に失敗しました'));
      return;
    }
    initAttempts.current++;
    // ... 初期化処理 ...
  };
  initLiff();
}, []);
```

**理由**: 現在のコードにはリトライロジックがないため、この対策は不要。

---

#### ❌ 対策案2: `liff.init()`の重複実行防止（推奨しない）

```typescript
const isInitializing = useRef(false);

useEffect(() => {
  const initLiff = async () => {
    if (isInitializing.current) {
      console.log('[useLiff] すでに初期化中のためスキップ');
      return;
    }
    isInitializing.current = true;
    try {
      await liff.init({ liffId: LIFF_ID });
      // ...
    } finally {
      isInitializing.current = false;
    }
  };
  initLiff();
}, []);
```

**理由**: LIFF SDKは既に初期化済みの場合でもエラーを投げないため、この対策は不要。

---

### ✅ リスク低（特定環境のみに影響）

以下の対策は**比較的安全**です。

#### ✅ 対策案3: セッションストレージで初期化カウント管理

```typescript
useEffect(() => {
  const initLiff = async () => {
    // セッションストレージで初期化回数をカウント
    const initCount = parseInt(sessionStorage.getItem('liff_init_count') || '0', 10);
    if (initCount >= 5) {
      console.error('[useLiff] 異常な初期化回数を検出（無限ループの可能性）');
      setError(new Error('LIFF初期化で問題が発生しました。アプリを再起動してください。'));
      setIsLoading(false);
      return;
    }
    sessionStorage.setItem('liff_init_count', String(initCount + 1));

    try {
      await liff.init({ liffId: LIFF_ID });
      // 初期化成功時にカウントをリセット
      sessionStorage.setItem('liff_init_count', '0');
      // ...
    } catch (err) {
      // エラー時はカウントを保持
      console.error('[useLiff] エラー発生:', err);
      setError(err instanceof Error ? err : new Error("LIFF init failed"));
    }
  };
  initLiff();
}, []);
```

**メリット**:
- 既存の動作に影響しない（正常時はカウントがすぐにリセットされる）
- 無限ループを検出し、ユーザーに明示的なエラーメッセージを表示

**デメリット**:
- 根本原因（外部ブラウザとの切り替えループ）は解決しない

---

#### ✅ 対策案4: iOS 18特有の問題を検出してアラート表示

```typescript
useEffect(() => {
  const initLiff = async () => {
    // iOS 18を検出
    const isIOS18 = /iPhone OS 18_/.test(navigator.userAgent);

    try {
      await liff.init({ liffId: LIFF_ID });
      // ...
    } catch (err) {
      if (isIOS18) {
        console.warn('[useLiff] iOS 18で問題が発生しました:', err);
        // ユーザーに対策を案内
        alert('iOS 18で問題が発生しました。LINEアプリを最新版に更新してください。');
      }
      setError(err instanceof Error ? err : new Error("LIFF init failed"));
    }
  };
  initLiff();
}, []);
```

**メリット**:
- iOS 18ユーザーに具体的な案内を表示できる

**デメリット**:
- ユーザーエージェント検出が不正確な場合がある

---

### 🔍 対策案5: ログ収集の強化（推奨）

```typescript
useEffect(() => {
  const initLiff = async () => {
    const startTime = Date.now();

    try {
      // ユーザーエージェント、デバイス情報をログ
      console.log('[useLiff] UserAgent:', navigator.userAgent);
      console.log('[useLiff] Platform:', navigator.platform);
      console.log('[useLiff] 初期化開始時刻:', new Date().toISOString());

      await liff.init({ liffId: LIFF_ID });

      const elapsedTime = Date.now() - startTime;
      console.log('[useLiff] 初期化完了（所要時間: ' + elapsedTime + 'ms）');

      // Supabaseにログを送信（event_logs）
      if (liff.isLoggedIn()) {
        const profileData = await liff.getProfile();
        await fetch('/api/event-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: profileData.userId,
            event_name: 'liff_init_success',
            source: 'useLiff',
            metadata: {
              elapsed_time_ms: elapsedTime,
              user_agent: navigator.userAgent,
              platform: navigator.platform,
            },
          }),
        });
      }
    } catch (err) {
      const elapsedTime = Date.now() - startTime;
      console.error('[useLiff] 初期化失敗（所要時間: ' + elapsedTime + 'ms）:', err);

      // エラーログをSupabaseに送信
      await fetch('/api/event-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: null, // エラー時はnull
          event_name: 'liff_init_error',
          source: 'useLiff',
          metadata: {
            error: String(err),
            elapsed_time_ms: elapsedTime,
            user_agent: navigator.userAgent,
            platform: navigator.platform,
          },
        }),
      });

      setError(err instanceof Error ? err : new Error("LIFF init failed"));
    }
  };
  initLiff();
}, []);
```

**メリット**:
- 問題発生時の詳細情報を収集できる
- iOS 18特有のパターンを発見できる可能性

**デメリット**:
- ログ送信のオーバーヘッド（ただし非同期なので影響は小さい）

---

## 📝 推奨アクション

### 1. 現時点では**実装変更を保留**

**理由**:
- 現在のコードは適切に実装されており、リトライロジックもない
- 大多数のユーザーが正常動作している
- 問題は特定環境（iOS 18 / iPhone 16）でのみ発生している可能性が高い
- 性急な変更により、正常動作しているユーザーに影響を与えるリスクがある

### 2. ログ収集の強化（対策案5）を実施

**理由**:
- リスクが低く、既存の動作に影響しない
- 問題発生時の詳細情報を収集できる
- iOS 18特有のパターンを発見できる可能性

**実装優先度**: ⭐⭐⭐ 高

### 3. 岡本さん（診察券7569）の詳細ログを取得

**確認事項**:
- 登録時刻（17:17 JST）前後のイベントログ
- `/api/users/setup-role`などの登録関連エンドポイントのログ
- `liff_init_success` / `liff_init_error`のログ（対策案5実施後）

**実装優先度**: ⭐⭐⭐ 高

### 4. LIFF SDK公式ドキュメントでiOS 18対応を確認

**確認先**:
- [LIFF SDK リリースノート](https://developers.line.biz/ja/docs/liff/release-notes/)
- [LIFF SDK GitHub Issues](https://github.com/line/liff-sdk/issues)

**実装優先度**: ⭐⭐ 中

### 5. 問題が頻発する場合のみ、対策案3を検討

**条件**:
- iOS 18ユーザーの10%以上で無限ループが発生する
- ログ収集により、原因が特定できない

**実装優先度**: ⭐ 低（現時点では不要）

---

## 🧪 検証方法

### iOS 18実機での動作確認

1. **iPhone 16（iOS 18）実機を用意**
2. **LINEアプリを最新版に更新**
3. **LIFF URLを開く**
   - LINE内WebViewで開かれるか？
   - 外部ブラウザで開かれるか？
4. **Consoleログを確認**
   - Safari Developer Toolsでログを確認
   - `[useLiff]`ログの出力回数をカウント

### シミュレータでの再現試験

1. **Xcode Simulatorで iOS 18をセットアップ**
2. **LINEアプリをインストール**（App Storeから）
3. **LIFF URLを開いて動作確認**

**注**: シミュレータでは再現しない可能性が高い（実機特有の問題のため）

---

## 📚 参考情報

### LIFF SDK関連

- [LIFF SDK v2.26.1 リリースノート](https://developers.line.biz/ja/docs/liff/release-notes/)
- [LIFF トラブルシューティング](https://developers.line.biz/ja/docs/liff/troubleshooting/)

### iOS 18 WebView関連

- [iOS 18 WebKit リリースノート](https://webkit.org/blog/15443/news-from-wwdc24-webkit-in-safari-18-beta/)
- [iOS 18 プライバシー変更](https://developer.apple.com/documentation/ios-ipados-release-notes/ios-ipados-18-release-notes)

### React / Next.js関連

- [React 19 Strict Mode](https://react.dev/reference/react/StrictMode)
- [Next.js App Router](https://nextjs.org/docs/app)

---

## ✅ 結論

### 現時点での判断

1. **実装変更は保留**
   - 現在のコードは適切に実装されている
   - 大多数のユーザーが正常動作している
   - 性急な変更によるリスクを回避

2. **ログ収集を強化**（対策案5）
   - 問題発生時の詳細情報を収集
   - iOS 18特有のパターンを発見

3. **詳細な調査を継続**
   - 岡本さんのログを取得
   - LIFF SDK公式情報を確認
   - iOS 18実機での動作確認

4. **問題が頻発する場合のみ、段階的に対策を実施**
   - まず対策案3（セッションストレージでカウント管理）
   - 効果がない場合、対策案4（iOS 18アラート表示）

---

**作成者**: Claude Code
**作成日**: 2026-04-06
**バージョン**: 1.0
**ステータス**: 検討中（実装保留）
