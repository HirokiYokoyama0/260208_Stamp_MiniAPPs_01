# バージョン管理運用ガイド

## 概要

このプロジェクトでは、GitHubのタグを使って**自動的にバージョンを管理**します。

---

## バージョン表示の仕組み

アプリのフッター（ページ最下部）に、以下の形式でバージョン情報が表示されます：

```
v1.2.3 • dev
```

| 項目 | 説明 | 取得元 |
|-----|------|--------|
| **バージョン番号** | 最新のGitタグ（例: v1.2.3） | `git describe --tags --abbrev=0` |
| **ビルド日時** | ビルドした日時 | ビルド時の現在時刻 |
| **コミットハッシュ** | 短縮版ハッシュ（例: 4657a47） | `git rev-parse --short HEAD` |
| **環境** | dev / production | `NODE_ENV` |

---

## バージョンアップの手順

### 1. コードの変更をコミット

```bash
git add .
git commit -m "feat: 新機能を追加"
```

### 2. Gitタグを作成してプッシュ

```bash
# 例: v1.2.3 にバージョンアップ
git tag v1.2.3

# タグをGitHubにプッシュ
git push origin v1.2.3
```

### 3. ビルド時に自動反映

```bash
# ローカルでビルド
npm run build

# → prebuildフックが自動的に実行され、
#   package.jsonのversionが1.2.3に更新される
#   next.config.mjsが自動的にv1.2.3を取得する
```

---

## バージョン番号の規則（Semantic Versioning）

**形式:** `MAJOR.MINOR.PATCH`（例: `1.2.3`）

| 変更内容 | 上げる桁 | 例 |
|---------|---------|---|
| **破壊的変更**（互換性なし） | MAJOR | 1.0.0 → 2.0.0 |
| **新機能追加**（互換性あり） | MINOR | 1.2.0 → 1.3.0 |
| **バグ修正**（互換性あり） | PATCH | 1.2.3 → 1.2.4 |

### 例

```bash
# バグ修正（1.0.0 → 1.0.1）
git tag v1.0.1

# 新機能追加（1.0.1 → 1.1.0）
git tag v1.1.0

# 大きな変更（1.1.0 → 2.0.0）
git tag v2.0.0
```

---

## 自動化の仕組み

### 1. `next.config.mjs`（ビルド時の環境変数設定）

```javascript
function getGitVersion() {
  const tag = execSync("git describe --tags --abbrev=0").trim();
  return tag.replace(/^v/, ""); // v1.2.3 → 1.2.3
}

const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: getGitVersion(),
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString(),
    NEXT_PUBLIC_GIT_COMMIT: execSync("git rev-parse --short HEAD").trim(),
  },
};
```

### 2. `scripts/update-version.mjs`（package.json自動更新）

```javascript
// Gitタグを取得してpackage.jsonのversionを更新
const version = getGitVersion(); // "1.2.3"
packageJson.version = version;
```

### 3. `package.json`（ビルド前フック）

```json
{
  "scripts": {
    "prebuild": "node scripts/update-version.mjs",
    "build": "next build"
  }
}
```

**実行順序:**
```
npm run build
  ↓
1. prebuild: update-version.mjsが実行される
  ↓
2. package.jsonのversionが更新される
  ↓
3. build: next buildが実行される
  ↓
4. next.config.mjsがGitタグからバージョンを取得
  ↓
5. ビルド完了（バージョン情報が埋め込まれる）
```

---

## タグの確認・削除

### 既存のタグを確認

```bash
# ローカルのタグ一覧
git tag

# リモートのタグ一覧
git ls-remote --tags origin
```

### タグの削除（間違えた場合）

```bash
# ローカルのタグを削除
git tag -d v1.2.3

# リモートのタグを削除
git push origin :refs/tags/v1.2.3
```

---

## 開発環境でのテスト

### 1. タグがない状態でビルド

```bash
npm run build
# → バージョンは "0.0.0-dev" になる
```

### 2. タグを作成してビルド

```bash
git tag v1.0.0
npm run build
# → バージョンは "1.0.0" になる
```

### 3. package.jsonの確認

```bash
cat package.json | grep version
# → "version": "1.0.0"
```

---

## Vercelでのデプロイ

Vercelは自動的にGitタグを認識します。

### 設定不要（自動）

1. GitHubにタグをプッシュ: `git push origin v1.2.3`
2. Vercelが自動的にデプロイを開始
3. ビルド時に `prebuild` が実行される
4. バージョン情報がアプリに埋め込まれる

### 環境変数の上書き（オプション）

Vercelの管理画面で環境変数を設定すると、Gitタグより優先されます：

```
NEXT_PUBLIC_APP_VERSION=1.2.3
```

**推奨:** 通常はGitタグに任せ、環境変数は緊急時のみ使用してください。

---

## トラブルシューティング

### Q1: バージョンが "0.0.0-dev" になる

**原因:** Gitタグが存在しない

**解決策:**
```bash
# タグを作成
git tag v1.0.0

# ビルド
npm run build
```

### Q2: package.jsonのバージョンが更新されない

**原因:** `prebuild` スクリプトが実行されていない

**解決策:**
```bash
# 手動でバージョン更新スクリプトを実行
npm run version:update

# または
node scripts/update-version.mjs
```

### Q3: Vercelでビルドが失敗する

**原因:** Gitコマンドが使えない環境の可能性

**解決策:** Vercelの環境変数で直接指定
```
NEXT_PUBLIC_APP_VERSION=1.2.3
NEXT_PUBLIC_BUILD_DATE=2026-02-09T12:00:00Z
NEXT_PUBLIC_GIT_COMMIT=4657a47
```

---

## 初回セットアップ

### 1. 現在のバージョンにタグを付ける

```bash
# 現在のコミットにv1.0.0タグを付ける
git tag v1.0.0

# GitHubにプッシュ
git push origin v1.0.0
```

### 2. ビルドして確認

```bash
npm run build
npm run start

# ブラウザで http://localhost:3000 を開く
# フッターに "v1.0.0 • production" と表示されることを確認
```

### 3. 開発モードで確認

```bash
npm run dev

# フッターに "v1.0.0 • dev" と表示されることを確認
```

---

## まとめ

✅ **Gitタグを作成するだけで、自動的にバージョンが更新される**
✅ **package.jsonも自動更新される**
✅ **ビルド日時・コミットハッシュも自動埋め込み**
✅ **Vercelデプロイでも自動的に動作する**

**運用ルール:**
1. 機能追加・バグ修正が完了したら、適切なバージョンタグを付ける
2. GitHubにプッシュ
3. 以上！（残りは自動）

---

## 改訂履歴

| 日付 | バージョン | 内容 |
|------|----------|------|
| 2026-02-09 | 1.0 | 初版作成 |
