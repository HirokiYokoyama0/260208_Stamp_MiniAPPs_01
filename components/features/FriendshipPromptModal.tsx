"use client";

import { Heart, ExternalLink, X } from "lucide-react";

interface FriendshipPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const OFFICIAL_ACCOUNT_URL = "https://line.me/R/ti/p/@550mlcao";

export default function FriendshipPromptModal({
  isOpen,
  onClose,
  onConfirm,
}: FriendshipPromptModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    // 公式アカウントのページを開く
    window.open(OFFICIAL_ACCOUNT_URL, "_blank");
  };

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 z-50 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* モーダル本体 */}
      <div className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 transform rounded-2xl bg-white p-6 shadow-xl">
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 transition-colors hover:text-gray-600"
          aria-label="閉じる"
        >
          <X size={24} />
        </button>

        {/* ハブラーシカアイコン */}
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Heart className="text-primary" size={32} />
          </div>
        </div>

        {/* タイトル */}
        <h2 className="mb-3 text-center text-xl font-bold text-gray-800">
          公式LINEを友だち追加しませんか？
        </h2>

        {/* 説明文 */}
        <p className="mb-4 text-center text-sm text-gray-600">
          友だち追加すると、以下の通知を受け取れます
        </p>

        {/* メリット一覧 */}
        <ul className="mb-6 space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">✓</span>
            <span>定期検診のリマインド通知</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">✓</span>
            <span>特典交換のお知らせ</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">✓</span>
            <span>お得なキャンペーン情報</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">✓</span>
            <span>休診日・診療時間変更のお知らせ</span>
          </li>
        </ul>

        {/* ボタンエリア */}
        <div className="flex flex-col gap-3">
          {/* 友だち追加ボタン */}
          <button
            onClick={handleConfirm}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#06C755] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#05b34b]"
          >
            <Heart size={18} />
            友だち追加する
            <ExternalLink size={16} />
          </button>

          {/* あとで追加ボタン */}
          <button
            onClick={onClose}
            className="rounded-lg px-6 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
          >
            あとで追加する
          </button>
        </div>

        {/* 補足メモ */}
        <p className="mt-4 text-center text-xs text-gray-500">
          ※医院情報ページからいつでも追加できます
        </p>
      </div>
    </>
  );
}
