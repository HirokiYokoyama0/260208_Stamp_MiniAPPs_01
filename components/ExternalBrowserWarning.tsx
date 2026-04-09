"use client";

import { useState } from "react";

interface ExternalBrowserWarningProps {
  onContinue?: () => void;
}

export function ExternalBrowserWarning({ onContinue }: ExternalBrowserWarningProps) {
  const [showInstructions, setShowInstructions] = useState(false);

  const handleOpenInLine = () => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

    // LINEアプリで開くディープリンクを実行
    window.location.href = `line://app/${liffId}`;

    // 3秒後にLINEアプリが起動しない場合、LIFF URLにフォールバック
    setTimeout(() => {
      window.location.href = `https://liff.line.me/${liffId}`;
    }, 3000);
  };

  const handleShowInstructions = () => {
    setShowInstructions(true);
  };

  const handleContinueAnyway = () => {
    if (onContinue) {
      onContinue();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-purple-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        {/* アイコン */}
        <div className="mb-6 text-center">
          <div className="mb-4 text-6xl">ℹ️</div>
          <h1 className="mb-2 text-2xl font-bold text-gray-800">
            外部ブラウザで開かれています
          </h1>
          <p className="text-sm text-gray-600">
            LINEアプリで開くことをおすすめします
          </p>
        </div>

        {/* 説明 */}
        <div className="mb-6 rounded-lg bg-blue-50 p-4">
          <p className="text-sm text-gray-700">
            外部ブラウザでも利用できますが、一部機能（カメラQRスキャンなど）が制限される場合があります。
          </p>
        </div>

        {/* LINEアプリで開くボタン */}
        <button
          onClick={handleOpenInLine}
          className="mb-3 w-full rounded-lg bg-[#06C755] px-6 py-4 font-bold text-white shadow-md transition-all hover:bg-[#05b04c] active:scale-[0.98]"
        >
          <div className="flex items-center justify-center gap-2">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
            </svg>
            <span>LINEアプリで開く</span>
          </div>
        </button>

        {/* QRコード再スキャンボタン */}
        <button
          onClick={handleShowInstructions}
          className="mb-3 w-full rounded-lg border-2 border-gray-300 bg-white px-6 py-4 font-bold text-gray-700 transition-all hover:bg-gray-50 active:scale-[0.98]"
        >
          QRコードを再スキャン
        </button>

        {/* このまま続けるボタン */}
        <button
          onClick={handleContinueAnyway}
          className="w-full rounded-lg border-2 border-blue-300 bg-blue-50 px-6 py-4 font-bold text-blue-800 transition-all hover:bg-blue-100 active:scale-[0.98]"
        >
          OK（このまま外部ブラウザで続ける）
        </button>

        {/* 手順説明（表示/非表示） */}
        {showInstructions && (
          <div className="mt-6 rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
            <h3 className="mb-3 font-bold text-gray-800">
              📱 QRコードの読み取り方法
            </h3>
            <ol className="space-y-2 text-sm text-gray-700">
              <li className="flex gap-2">
                <span className="font-bold">1.</span>
                <span>LINEアプリを開く</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">2.</span>
                <span>ホーム画面右上のQRコードアイコンをタップ</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">3.</span>
                <span>登録QRコードを再度読み取る</span>
              </li>
            </ol>
          </div>
        )}

        {/* 補足説明 */}
        <div className="mt-6 rounded-lg bg-gray-50 p-4">
          <p className="text-xs text-gray-600">
            <strong>ご不明な点がございましたら</strong>
            <br />
            つくばホワイト歯科・矯正歯科のスタッフまでお気軽にお声がけください。
          </p>
        </div>
      </div>
    </div>
  );
}
