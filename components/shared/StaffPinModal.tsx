"use client";

import { useState, useEffect } from "react";
import { X, Plus, Minus } from "lucide-react";

interface StaffPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStampCount: number; // 現在のスタンプ数
  onSubmit: (pin: string, newCount: number) => Promise<void>;
  isLoading?: boolean;
  userId?: string; // QRスキャン削除用のユーザーID
}

type Step = "auth" | "edit";

/**
 * スタッフ暗証番号入力モーダル（スタンプ数編集機能付き）
 */
export function StaffPinModal({
  isOpen,
  onClose,
  currentStampCount,
  onSubmit,
  isLoading = false,
  userId,
}: StaffPinModalProps) {
  const [step, setStep] = useState<Step>("auth");
  const [pin, setPin] = useState("");
  const [newStampCount, setNewStampCount] = useState(currentStampCount);
  const [error, setError] = useState("");
  const [isDeletingQR, setIsDeletingQR] = useState(false);

  // モーダルが開いたときにスタンプ数を初期化
  useEffect(() => {
    if (isOpen) {
      setNewStampCount(currentStampCount);
      setStep("auth");
      setPin("");
      setError("");
    }
  }, [isOpen, currentStampCount]);

  // 暗証番号認証
  const handleAuth = async () => {
    if (pin.length !== 4) {
      setError("暗証番号は4桁で入力してください");
      return;
    }

    // 暗証番号の簡易チェック（実際の検証はAPI側で行う）
    const correctPin = process.env.NEXT_PUBLIC_STAFF_PIN || "1234";
    if (pin !== correctPin) {
      setError("暗証番号が間違っています");
      return;
    }

    setError("");
    setStep("edit"); // 編集ステップに進む
  };

  // スタンプ数更新
  const handleUpdate = async () => {
    await onSubmit(pin, newStampCount);
  };

  const handleClose = () => {
    setStep("auth");
    setPin("");
    setNewStampCount(currentStampCount);
    setError("");
    onClose();
  };

  // スタンプ数の増減
  const incrementCount = () => {
    setNewStampCount((prev) => Math.min(prev + 1, 999)); // 最大999個
  };

  const decrementCount = () => {
    setNewStampCount((prev) => Math.max(prev - 1, 0)); // 最小0個
  };

  // 本日のQRスキャン削除
  const handleDeleteTodayQR = async () => {
    if (!userId) {
      alert("ユーザーIDが不足しています");
      return;
    }

    if (!confirm("本日のQRスキャン履歴を削除しますか？\nこの操作は元に戻せません。")) {
      return;
    }

    setIsDeletingQR(true);
    try {
      const response = await fetch("/api/stamps/scan/delete-today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();

      if (result.success) {
        alert(result.message);
        handleClose(); // モーダルを閉じる
        window.location.reload(); // ページをリロードして最新データを表示
      } else {
        alert(result.message || "削除に失敗しました");
      }
    } catch (error) {
      console.error("❌ QRスキャン削除エラー:", error);
      alert("エラーが発生しました");
    } finally {
      setIsDeletingQR(false);
    }
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

        {/* ステップ1: 暗証番号入力 */}
        {step === "auth" && (
          <>
            <p className="mb-6 text-sm text-gray-600">
              暗証番号を入力してください
            </p>

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
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleAuth}
                disabled={isLoading || pin.length !== 4}
                className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                次へ
              </button>
            </div>
          </>
        )}

        {/* ステップ2: スタンプ数編集 */}
        {step === "edit" && (
          <>
            <p className="mb-6 text-sm text-gray-600">
              スタンプ数を調整してください
            </p>

            {/* 現在のスタンプ数 */}
            <div className="mb-4 rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-gray-500">現在のスタンプ数</p>
              <p className="text-2xl font-bold text-gray-800">
                {currentStampCount}個
              </p>
            </div>

            {/* スタンプ数調整 */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                新しいスタンプ数
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={decrementCount}
                  disabled={isLoading || newStampCount <= 0}
                  className="flex h-12 w-12 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Minus size={20} />
                </button>
                <div className="flex-1 rounded-lg border-2 border-primary bg-primary/5 py-3 text-center text-3xl font-bold text-primary">
                  {newStampCount}
                </div>
                <button
                  onClick={incrementCount}
                  disabled={isLoading || newStampCount >= 999}
                  className="flex h-12 w-12 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={20} />
                </button>
              </div>
              <p className="mt-2 text-center text-xs text-gray-500">
                変更: {newStampCount > currentStampCount ? "+" : ""}
                {newStampCount - currentStampCount}個
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  disabled={isLoading || isDeletingQR}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={isLoading || isDeletingQR}
                  className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? "処理中..." : "更新"}
                </button>
              </div>

              {/* 本日のQRスキャン削除ボタン */}
              {userId && (
                <button
                  onClick={handleDeleteTodayQR}
                  disabled={isLoading || isDeletingQR}
                  className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeletingQR ? "削除中..." : "🗑️ 本日のQRスキャンを削除"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
