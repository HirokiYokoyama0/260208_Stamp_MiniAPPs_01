"use client";

import { getVersionInfo, formatVersionInfo } from "@/lib/version";

/**
 * バージョン情報表示コンポーネント
 * ページ下部に控えめに表示
 */
export function VersionInfo() {
  const versionInfo = getVersionInfo();
  const versionText = formatVersionInfo(versionInfo);

  return (
    <div className="mt-12 border-t border-gray-100 pt-4 text-center">
      <p className="text-xs text-gray-400">
        {versionText}
        {versionInfo.buildDate && (
          <span className="ml-2 text-gray-300">
            {new Date(versionInfo.buildDate).toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })}
          </span>
        )}
      </p>
    </div>
  );
}
