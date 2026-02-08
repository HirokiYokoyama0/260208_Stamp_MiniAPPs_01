"use client";

import { useEffect } from "react";
import { useLiff } from "@/hooks/useLiff";
import { QRScanner } from "@/components/features/QRScanner";
import { Smile } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const { isInitialized, isLoggedIn, isLoading, profile, login } = useLiff();

  // LINEログイン成功後、ユーザー情報をSupabaseに保存
  useEffect(() => {
    const saveUserProfile = async () => {
      if (!profile) return;

      try {
        const { data, error } = await supabase.from("profiles").upsert(
          {
            id: profile.userId, // LINEのユーザーIDをそのまま主キーとして使用
            line_user_id: profile.userId,
            display_name: profile.displayName,
            picture_url: profile.pictureUrl,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "id", // idで重複チェック
          }
        );

        if (error) {
          console.error("❌ ユーザー情報の保存に失敗しました:", error);
        } else {
          console.log("✅ ユーザー情報をDBに保存しました:", {
            userId: profile.userId,
            displayName: profile.displayName,
          });
        }
      } catch (err) {
        console.error("❌ 予期しないエラーが発生しました:", err);
      }
    };

    if (isLoggedIn && profile) {
      saveUserProfile();
    }
  }, [isLoggedIn, profile]);

  // スタブデータ（後でSupabase等と連携）
  const stubTicketNo = "1234-5678";
  const stubName = profile?.displayName ?? "ゲスト";
  const stubDaysUntilNext = 45;
  const stubStampCount = 3;
  const stubStampGoal = 10;

  if (!isInitialized || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6">
        <p className="mb-6 text-center text-gray-600">
          LINEでログインして
          <br />
          デジタル診察券をご利用ください
        </p>
        <button
          type="button"
          onClick={login}
          className="rounded-lg bg-[#06C755] px-8 py-3 font-medium text-white transition-colors hover:bg-[#05b04c]"
        >
          LINEでログイン
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-6">
      {/* デジタル診察券カード */}
      <section className="rounded-xl border border-gray-100 bg-gradient-to-br from-white to-gray-50/50 p-5 shadow-sm">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-gray-400">
          デジタル診察券
        </h2>
        <div className="space-y-2">
          <p className="text-2xl font-semibold text-gray-800">{stubName}</p>
          <p className="font-mono text-sm text-gray-600">
            診察券番号: {stubTicketNo}
          </p>
        </div>
      </section>

      {/* ハブラーシカのメッセージ */}
      <section className="flex items-start gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/20">
          <Smile size={24} className="text-primary-dark" strokeWidth={1.5} />
        </div>
        <div className="flex-1 pt-1">
          <p className="text-sm text-gray-700">
            次回の定期検診まで
            <span className="font-semibold text-primary-dark">
              あと{stubDaysUntilNext}日
            </span>
            です。
            <br />
            お疲れ様です！今日も歯のケア、一緒に頑張りましょう。
          </p>
        </div>
      </section>

      {/* 来院スタンプボタン */}
      <section>
        <QRScanner
          onScan={(value) => {
            console.log("QR scanned:", value);
            // TODO: バックエンドに来院登録APIを叩く
          }}
          onError={(err) => {
            console.error("QR scan error:", err);
          }}
        />
      </section>

      {/* スタンプ進捗 */}
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-gray-400">
          現在のスタンプ進捗
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">通院スタンプ</span>
            <span className="font-semibold text-gray-800">
              {stubStampCount} / {stubStampGoal}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary-dark transition-all"
              style={{
                width: `${Math.min(100, (stubStampCount / stubStampGoal) * 100)}%`,
              }}
            />
          </div>
          <p className="text-xs text-gray-500">
            あと{stubStampGoal - stubStampCount}回でごほうび交換可能です
          </p>
        </div>
      </section>
    </div>
  );
}
