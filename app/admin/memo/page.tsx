"use client";

import { useState } from "react";
import { updateUserMemo } from "@/lib/memo";

export default function AdminMemoPage() {
  const [userId, setUserId] = useState("");
  const [nextVisitDate, setNextVisitDate] = useState("");
  const [nextMemo, setNextMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId.trim()) {
      setMessage("❌ ユーザーIDを入力してください");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const result = await updateUserMemo(
        userId.trim(),
        nextVisitDate || null,
        nextMemo || null
      );

      if (result.success) {
        setMessage(`✅ ${result.message}`);
        // フォームをクリアしない（連続編集できるように）
      } else {
        setMessage(`❌ ${result.message}`);
      }
    } catch (error) {
      console.error("❌ メモ更新エラー:", error);
      setMessage("❌ エラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    setUserId("");
    setNextVisitDate("");
    setNextMemo("");
    setMessage("");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h1 className="mb-6 text-2xl font-bold text-gray-800">
            次回メモ編集（管理者用）
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ユーザーID入力 */}
            <div>
              <label
                htmlFor="userId"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                ユーザーID（LINE User ID）<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="例: U1234567890abcdef1234567890abcdef"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                ※ LINEのユーザーID（Uから始まる33文字）を入力してください
              </p>
            </div>

            {/* 次回来院予定日 */}
            <div>
              <label
                htmlFor="nextVisitDate"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                次回来院予定日（オプション）
              </label>
              <input
                type="date"
                id="nextVisitDate"
                value={nextVisitDate}
                onChange={(e) => setNextVisitDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="mt-1 text-xs text-gray-500">
                ※ 設定すると「次回の定期検診は○年○月○日です」と表示されます
              </p>
            </div>

            {/* カスタムメモ */}
            <div>
              <label
                htmlFor="nextMemo"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                カスタムメッセージ（オプション）
              </label>
              <textarea
                id="nextMemo"
                value={nextMemo}
                onChange={(e) => setNextMemo(e.target.value)}
                placeholder="例: お疲れ様です！今日も歯のケア、一緒に頑張りましょう。"
                rows={4}
                maxLength={200}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="mt-1 text-xs text-gray-500">
                ※ 最大200文字まで入力できます（{nextMemo.length}/200）
              </p>
            </div>

            {/* メッセージプレビュー */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                プレビュー
              </p>
              <p className="text-sm text-gray-700">
                {nextVisitDate ? (
                  <>
                    次回の定期検診は
                    <span className="font-semibold text-primary-dark">
                      {new Date(nextVisitDate).toLocaleDateString("ja-JP", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                    です。
                    {nextMemo && (
                      <>
                        <br />
                        {nextMemo}
                      </>
                    )}
                  </>
                ) : nextMemo ? (
                  <>{nextMemo}</>
                ) : (
                  <>
                    次回のご来院をお待ちしております。毎日の歯磨き、頑張りましょう！
                  </>
                )}
              </p>
            </div>

            {/* メッセージ表示エリア */}
            {message && (
              <div
                className={`rounded-lg p-4 ${
                  message.startsWith("✅")
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {message}
              </div>
            )}

            {/* ボタン */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "更新中..." : "メモを更新"}
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                クリア
              </button>
            </div>
          </form>

          <div className="mt-8 border-t border-gray-200 pt-6">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              使い方
            </h2>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                1. ユーザーIDは患者のLINE User IDを入力してください（Supabaseの
                <code className="rounded bg-gray-100 px-1 py-0.5">
                  profiles
                </code>
                テーブルの
                <code className="rounded bg-gray-100 px-1 py-0.5">id</code>
                カラム）
              </li>
              <li>
                2.
                次回来院予定日を設定すると「次回の定期検診は○年○月○日です」と表示されます
              </li>
              <li>
                3.
                カスタムメッセージで追加のメッセージを入力できます（2行目に表示）
              </li>
              <li>
                4.
                両方とも未入力の場合は、デフォルトメッセージが表示されます
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
