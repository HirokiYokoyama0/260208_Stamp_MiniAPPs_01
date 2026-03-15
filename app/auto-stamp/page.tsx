"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import liff from "@line/liff";

type Status = "loading" | "success" | "error" | "already_received";

function AutoStampContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [stampCount, setStampCount] = useState(0);
  const [addedAmount, setAddedAmount] = useState(0);

  useEffect(() => {
    const processAutoStamp = async () => {
      try {
        // LIFF初期化
        if (!liff.isInClient()) {
          setStatus("error");
          setMessage("このページはLINEアプリ内でのみ利用できます");
          return;
        }

        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        // URLパラメータを取得
        const action = searchParams.get("action");
        const type = searchParams.get("type");
        const amount = searchParams.get("amount");
        const location = searchParams.get("location");

        // バリデーション
        if (action !== "stamp" || type !== "qr") {
          setStatus("error");
          setMessage("無効なQRコードです");
          return;
        }

        const stampAmount = parseInt(amount || "0");
        if (![5, 10].includes(stampAmount)) {
          setStatus("error");
          setMessage("無効なスタンプ数です");
          return;
        }

        // ユーザーIDを取得
        const profile = await liff.getProfile();
        const userId = profile.userId;

        console.log(`[AutoStamp] スタンプ自動付与開始: userId=${userId}, amount=${stampAmount}`);

        // スタンプ自動付与APIを呼び出し
        const response = await fetch("/api/stamps/auto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            amount: stampAmount,
            type: "qr",
            location: location || null,
          }),
        });

        const result = await response.json();

        if (result.success) {
          setStatus("success");
          setMessage(result.message);
          setStampCount(result.stampCount);
          setAddedAmount(result.addedAmount);
          console.log(`✅ スタンプ自動付与成功: +${result.addedAmount}個`);
        } else if (result.alreadyReceived) {
          setStatus("already_received");
          setMessage(result.message);
          console.log("⚠️ 本日は既に受け取り済み");
        } else {
          setStatus("error");
          setMessage(result.message || "スタンプの付与に失敗しました");
          console.error("❌ スタンプ自動付与失敗:", result.message);
        }

      } catch (error) {
        console.error("❌ AutoStamp処理エラー:", error);
        setStatus("error");
        setMessage("エラーが発生しました");
      }
    };

    processAutoStamp();
  }, [searchParams]);

  // ホームに戻る
  const handleGoHome = () => {
    router.push("/");
  };

  // ローディング画面
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="mb-4 text-6xl">⏳</div>
          <p className="text-lg font-bold text-gray-700">スタンプを付与しています...</p>
        </div>
      </div>
    );
  }

  // 成功画面
  if (status === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-50 to-blue-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <div className="mb-4 text-8xl">🎉</div>
          <h1 className="mb-2 text-2xl font-bold text-green-600">スタンプ獲得！</h1>
          <p className="mb-6 text-gray-600">{message}</p>

          <div className="mb-6 rounded-xl bg-gradient-to-r from-yellow-100 to-orange-100 p-6">
            <p className="mb-2 text-sm text-gray-600">獲得スタンプ</p>
            <p className="mb-4 text-5xl font-bold text-orange-600">+{addedAmount}個</p>
            <div className="border-t border-orange-200 pt-4">
              <p className="text-sm text-gray-600">現在の合計</p>
              <p className="text-3xl font-bold text-gray-800">{stampCount}個</p>
            </div>
          </div>

          <button
            onClick={handleGoHome}
            className="w-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-6 py-3 font-bold text-white shadow-lg transition-all hover:from-blue-600 hover:to-purple-600 active:scale-95"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  // 既に受け取り済み画面
  if (status === "already_received") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-yellow-50 to-orange-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <div className="mb-4 text-8xl">⚠️</div>
          <h1 className="mb-2 text-2xl font-bold text-orange-600">既に受け取り済み</h1>
          <p className="mb-6 text-gray-600">{message}</p>

          <div className="mb-6 rounded-xl bg-orange-50 p-4">
            <p className="text-sm text-gray-600">
              QRコードでのスタンプ獲得は1日1回までです。
              <br />
              また明日お越しください！
            </p>
          </div>

          <button
            onClick={handleGoHome}
            className="w-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-6 py-3 font-bold text-white shadow-lg transition-all hover:from-blue-600 hover:to-purple-600 active:scale-95"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  // エラー画面
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-red-50 to-pink-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mb-4 text-8xl">❌</div>
        <h1 className="mb-2 text-2xl font-bold text-red-600">エラー</h1>
        <p className="mb-6 text-gray-600">{message}</p>

        <button
          onClick={handleGoHome}
          className="w-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-6 py-3 font-bold text-white shadow-lg transition-all hover:from-blue-600 hover:to-purple-600 active:scale-95"
        >
          ホームに戻る
        </button>
      </div>
    </div>
  );
}

export default function AutoStampPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="mb-4 text-6xl">⏳</div>
          <p className="text-lg font-bold text-gray-700">読み込み中...</p>
        </div>
      </div>
    }>
      <AutoStampContent />
    </Suspense>
  );
}
