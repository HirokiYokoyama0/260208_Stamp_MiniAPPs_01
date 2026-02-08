"use client";

import { useCallback } from "react";
import liff from "@line/liff";
import { QrCode } from "lucide-react";

interface QRScannerProps {
  onScan?: (result: string) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * 来院スタンプ用QRスキャンボタン
 * liff.scanCodeV2() を呼び出し、受付QRをスキャンする
 */
export function QRScanner({
  onScan,
  onError,
  disabled = false,
  className = "",
  children,
}: QRScannerProps) {
  const handleScan = useCallback(async () => {
    if (disabled) return;

    try {
      const result = await liff.scanCodeV2();
      if (result?.value) {
        onScan?.(result.value);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("QR scan failed");
      onError?.(error);
    }
  }, [disabled, onScan, onError]);

  return (
    <button
      type="button"
      onClick={handleScan}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg
        bg-primary px-4 py-3 text-sm font-medium text-white
        transition-colors hover:bg-primary-dark
        disabled:cursor-not-allowed disabled:opacity-50
        ${className}
      `}
    >
      <QrCode size={20} strokeWidth={2} />
      {children ?? "来院スタンプを読み取る"}
    </button>
  );
}
