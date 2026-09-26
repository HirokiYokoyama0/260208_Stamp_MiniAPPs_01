// Vercel ログ自動取得ラッパー
// -----------------------------------------------------------------------------
// .env.local の VERCEL_TOKEN を自動で読み込み、Vercel CLI の `vercel logs` を
// project/scope 付きで実行する。トークンは環境変数で子プロセスに渡す（argvに出さない）。
//
// 使い方（npm run logs -- <options> でも同じ）:
//   node scripts/fetch-vercel-logs.mjs                       直近1日・100件（人が読む形式）
//   node scripts/fetch-vercel-logs.mjs --since 1h            直近1時間
//   node scripts/fetch-vercel-logs.mjs --source serverless --expand   API(関数)ログのみ・本文展開
//   node scripts/fetch-vercel-logs.mjs --status-code 500     500だけ
//   node scripts/fetch-vercel-logs.mjs --json > logs.jsonl   JSON Lines で保存
//   node scripts/fetch-vercel-logs.mjs --follow              ライブtail（Ctrl+Cで停止）
//   node scripts/fetch-vercel-logs.mjs --query "status:500 error"   高度な検索
//
// 主な CLI オプション: --since/--until(1h,30m,7d,ISO) --limit(-n) --source
//   (serverless|edge-function|edge-middleware|static) --status-code --level
//   --request-id --branch --json --expand(-x) --follow(-f) --query(-q)
// -----------------------------------------------------------------------------
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

// --- 対象プロジェクト（このリポジトリ固定。必要なら環境変数で上書き可） ---
const PROJECT = process.env.VERCEL_PROJECT || '260208-stamp-mini-ap-ps-01';
const SCOPE = process.env.VERCEL_SCOPE || 'hirokiyokoyama0s-projects';
const CLI = 'vercel@60.1.3'; // 動作確認済みバージョンに固定（npxキャッシュ利用で高速）

// --- VERCEL_TOKEN の取得（.env.local 優先 → 環境変数フォールバック） ---
function loadToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  try {
    const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    const line = env.split(/\r?\n/).find((l) => l.startsWith('VERCEL_TOKEN='));
    if (line) return line.slice('VERCEL_TOKEN='.length).trim();
  } catch {
    /* .env.local が無い場合は環境変数のみ */
  }
  return null;
}

const token = loadToken();
if (!token) {
  console.error('❌ VERCEL_TOKEN が見つかりません（.env.local か環境変数に設定してください）');
  process.exit(1);
}

// --- 引数: ユーザー指定をそのまま渡す。無指定ならデフォルト（直近1日・100件） ---
const userArgs = process.argv.slice(2);
const passthrough = userArgs.length > 0 ? userArgs : ['--since', '1d', '-n', '100'];

const args = ['--yes', CLI, 'logs', ...passthrough, '--project', PROJECT, '--scope', SCOPE];

// --- cmd/sh 両対応のクォート（--query "status:500 error" 等の空白を保護） ---
const q = (a) => (/[\s"']/.test(a) ? '"' + String(a).replace(/"/g, '\\"') + '"' : a);
const command = ['npx', ...args].map(q).join(' ');

const child = spawn(command, {
  stdio: 'inherit',
  shell: true, // Windows(npx.cmd)対応のため shell 経由
  env: { ...process.env, VERCEL_TOKEN: token },
});

child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error('❌ 実行エラー:', err.message);
  process.exit(1);
});
