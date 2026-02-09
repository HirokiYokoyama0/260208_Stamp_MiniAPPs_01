import { execSync } from "child_process";

/**
 * Gitタグからバージョンを取得（最新のタグを取得）
 * タグがない場合は "0.0.0-dev" を返す
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
      return "0.0.0-dev";
    }

    // "v" プレフィックスを除去（例: v1.0.0 → 1.0.0）
    return tag.replace(/^v/, "");
  } catch {
    // タグがない場合は開発バージョン
    return "0.0.0-dev";
  }
}

/**
 * Gitコミットハッシュを取得（短縮版）
 */
function getGitCommit() {
  try {
    return execSync("git rev-parse --short HEAD", {
      encoding: "utf-8",
    }).trim();
  } catch {
    return "";
  }
}

/**
 * ビルド日時を取得
 */
function getBuildDate() {
  return new Date().toISOString();
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Gitタグから自動取得（環境変数で上書き可能）
    NEXT_PUBLIC_APP_VERSION:
      process.env.NEXT_PUBLIC_APP_VERSION || getGitVersion(),
    // ビルド日時を自動設定
    NEXT_PUBLIC_BUILD_DATE:
      process.env.NEXT_PUBLIC_BUILD_DATE || getBuildDate(),
    // Gitコミットハッシュを自動設定
    NEXT_PUBLIC_GIT_COMMIT:
      process.env.NEXT_PUBLIC_GIT_COMMIT || getGitCommit(),
  },
};

export default nextConfig;
