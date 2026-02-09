"use client";

import { useState, useRef } from "react";
import { getVersionInfo, formatVersionInfo } from "@/lib/version";

interface VersionInfoProps {
  onTripleTap?: () => void; // 3回タップ時のコールバック
}

/**
 * バージョン情報表示コンポーネント
 * ページ下部に控えめに表示
 * 3回連続タップでスタッフ機能を呼び出し
 */
export function VersionInfo({ onTripleTap }: VersionInfoProps) {
  const versionInfo = getVersionInfo();
  const versionText = formatVersionInfo(versionInfo);

  const [tapCount, setTapCount] = useState(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTap = () => {
    // タイムアウトをクリア
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    const newTapCount = tapCount + 1;
    setTapCount(newTapCount);

    // 3回タップで発火
    if (newTapCount === 3) {
      setTapCount(0);
      onTripleTap?.();
      return;
    }

    // 2秒後にリセット
    tapTimeoutRef.current = setTimeout(() => {
      setTapCount(0);
    }, 2000);
  };

  return (
    <div className="mt-12 border-t border-gray-100 pt-4 text-center">
      <p
        className="cursor-pointer select-none text-xs text-gray-400 transition-colors active:text-gray-600"
        onClick={handleTap}
      >
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
