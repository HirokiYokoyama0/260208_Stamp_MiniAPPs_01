# 🚀 クイックスタートガイド

## ⚠️ 現在の問題: ポート 4000 が使用中

ngrokは既に起動していますが、Next.jsサーバーがポート競合で起動できていません。

### 📋 解決手順

#### 方法1: タスクマネージャーで終了（推奨）

1. **タスクマネージャーを開く**
   - `Ctrl + Shift + Esc` を押す

2. **詳細タブを開く**
   - 下部の「詳細」タブをクリック

3. **Node.js プロセスを探す**
   - 「PID」列でプロセスをソート
   - **PID 8300** を探す（通常は `node.exe` という名前）

4. **プロセスを終了**
   - 該当プロセスを右クリック
   - 「タスクの終了」をクリック

5. **サーバーを再起動**
   ```bash
   npm run dev
   ```

#### 方法2: PowerShellで終了

PowerShellを**管理者として実行**してから：

```powershell
Stop-Process -Id 8300 -Force
```

その後：
```bash
npm run dev
```

---

## ✅ 正常起動後の確認

### 1. ローカルで確認

ブラウザで開く: http://localhost:4000

### 2. ngrok URL

**既に起動済み**: https://vibrioid-jolyn-polyphonically.ngrok-free.dev

このURLをLINE DevelopersのLIFFエンドポイントURLに設定してください。

---

## 📝 完全な起動手順（通常時）

```bash
# ターミナル1: Next.js サーバー
npm run dev

# ターミナル2: ngrok トンネル
npx ngrok http 4000
```

**ポート**: 4000

---

## 🔧 よくある問題

### Q: ポートが既に使用されている

```bash
# Windows
netstat -ano | findstr :4000
taskkill /F /PID <プロセスID>
```

### Q: ngrokが "endpoint already online" エラー

既に起動している場合は、そのまま使用できます。
URLは前回と同じ：
```
https://vibrioid-jolyn-polyphonically.ngrok-free.dev
```

### Q: ngrokを再起動したい

```bash
# 既存のngrokを全て終了
taskkill /F /IM ngrok.exe

# 再起動
npx ngrok http 4000
```

---

## 📚 詳細情報

詳しいコマンドは [Doc/200_実行コマンド.md](Doc/200_実行コマンド.md) を参照してください。
