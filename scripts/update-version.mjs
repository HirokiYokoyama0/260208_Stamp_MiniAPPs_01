#!/usr/bin/env node

/**
 * Gitタグからpackage.jsonのバージョンを自動更新するスクリプト
 *
 * 使い方:
 *   node scripts/update-version.mjs
 *
 * 動作:
 *   1. git describe --tags で最新のタグを取得
 *   2. package.jsonのversionフィールドを更新
 *   3. タグがない場合は "0.0.0-dev" を設定
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(__dirname, "..", "package.json");

/**
 * Gitタグからバージョンを取得（最新のタグを取得）
 */
function getGitVersion() {
  try {
    // バージョン順にソートして最新のタグを取得
    const tag = execSync("git tag --sort=-version:refname", {
      encoding: "utf-8",
    })
      .trim()
      .split("\n")[0]; // 最初の行（最新のタグ）

    if (!tag) {
      console.warn("⚠️  Gitタグが見つかりません。デフォルトバージョンを使用します。");
      return "0.0.0-dev";
    }

    // "v" プレフィックスを除去（例: v1.0.0 → 1.0.0）
    return tag.replace(/^v/, "");
  } catch {
    console.warn("⚠️  Gitタグが見つかりません。デフォルトバージョンを使用します。");
    return "0.0.0-dev";
  }
}

/**
 * package.jsonのversionを更新
 */
function updatePackageVersion() {
  const version = getGitVersion();

  // package.jsonを読み込み
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

  // バージョンが同じなら何もしない
  if (packageJson.version === version) {
    console.log(`✅ バージョンは既に ${version} です。更新不要。`);
    return;
  }

  // バージョンを更新
  packageJson.version = version;

  // package.jsonに書き込み
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");

  console.log(`✅ package.json のバージョンを ${version} に更新しました。`);
}

// 実行
updatePackageVersion();
