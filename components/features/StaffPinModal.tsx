"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface StaffPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => Promise<void>;
  isLoading?: boolean;
}

/**
 * スタッフ暗証番号入力モーダル
 */
export function StaffPinModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: StaffPinModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (pin.length !== 4) {
      setError("暗証番号は4桁で入力してください");
      return;
    }

    setError("");
    await onSubmit(pin);
  };

  const handleClose = () => {
    setPin("");
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        {/* ヘッダー */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            スタッフ操作
          </h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* 説明 */}
        <p className="mb-6 text-sm text-gray-600">
          QRコードが読み取れない場合のみ使用してください
        </p>

        {/* 暗証番号入力 */}
        <div className="mb-6">
          <label
            htmlFor="staff-pin"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            暗証番号（4桁）
          </label>
          <input
            id="staff-pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "");
              setPin(value);
              setError("");
            }}
            disabled={isLoading}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-2xl tracking-widest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
            placeholder="••••"
            autoFocus
          />
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* ボタン */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || pin.length !== 4}
            className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "処理中..." : "スタンプを付与"}
          </button>
        </div>
      </div>
    </div>
  );
}
