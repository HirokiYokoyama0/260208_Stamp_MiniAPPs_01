/**
 * アプリケーションのバージョン情報を取得
 */
export interface VersionInfo {
  version: string;
  buildDate: string;
  gitCommit: string;
  env: string;
}

/**
 * バージョン情報を取得
 */
export const getVersionInfo = (): VersionInfo => {
  return {
    version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
    buildDate: process.env.NEXT_PUBLIC_BUILD_DATE || "",
    gitCommit: process.env.NEXT_PUBLIC_GIT_COMMIT?.slice(0, 7) || "",
    env: process.env.NODE_ENV,
  };
};

/**
 * バージョン情報を文字列にフォーマット
 */
export const formatVersionInfo = (info: VersionInfo): string => {
  const parts = [`v${info.version}`];

  if (info.env === "development") {
    parts.push("dev");
  }

  if (info.gitCommit) {
    parts.push(info.gitCommit);
  }

  return parts.join(" • ");
};
