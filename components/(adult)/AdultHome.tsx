"use client";

import { useEffect, useState } from "react";
import { useLiff } from "@/hooks/useLiff";
import { QRScanner } from "@/components/shared/QRScanner";
import { VersionInfo } from "@/components/layout/VersionInfo";
import { StaffPinModal } from "@/components/shared/StaffPinModal";
import { Smile } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { addStamp, fetchStampCount } from "@/lib/stamps";

export default function AdultHome() {
  const { isInitialized, isLoggedIn, isLoading, profile, login } = useLiff();
  const [stampCount, setStampCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [isStaffLoading, setIsStaffLoading] = useState(false);

  // Supabaseからユーザーデータを取得
  const fetchUserData = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("stamp_count, updated_at, ticket_number")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("❌ ユーザーデータの取得に失敗しました:", error);
        return;
      }

      if (data) {
        setStampCount(data.stamp_count ?? 0);
        setLastUpdated(data.updated_at);
        setTicketNumber(data.ticket_number);
        console.log("✅ ユーザーデータを取得しました:", {
          stampCount: data.stamp_count,
          updatedAt: data.updated_at,
          ticketNumber: data.ticket_number,
        });
      }
    } catch (err) {
      console.error("❌ 予期しないエラーが発生しました:", err);
    }
  };

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
          // 保存後、最新のユーザーデータを取得
          await fetchUserData(profile.userId);
        }
      } catch (err) {
        console.error("❌ 予期しないエラーが発生しました:", err);
      }
    };

    if (isLoggedIn && profile) {
      saveUserProfile();
    }
  }, [isLoggedIn, profile]);

  // 日付フォーマット関数
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "未登録";

    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");

    return `${year}年${month}月${day}日 ${hours}:${minutes}`;
  };

  // 予約ボタン：診察券番号をコピーしてからアポツールを開く
  const handleReservation = async () => {
    if (displayTicketNumber === "未登録") {
      alert("診察券番号が登録されていません。受付でご登録をお願いします。");
      return;
    }

    try {
      // 診察券番号をクリップボードにコピー
      await navigator.clipboard.writeText(displayTicketNumber);
      console.log("✅ 診察券番号をコピーしました:", displayTicketNumber);

      // コピー成功メッセージを表示
      alert(`診察券番号をコピーしました！\n予約画面で貼り付けてください。\n\n診察券番号: ${displayTicketNumber}`);

      // アポツールを開く
      window.open("https://reservation.stransa.co.jp/5d62710843af2685c64352ed3eb9d043", "_blank");
    } catch (error) {
      console.error("❌ コピーに失敗しました:", error);
      alert("コピーに失敗しました");
    }
  };

  // スタッフ暗証番号による手動スタンプ数変更
  const handleStaffSubmit = async (pin: string, newCount: number) => {
    if (!profile?.userId) {
      alert("ログインしてください");
      return;
    }

    setIsStaffLoading(true);
    try {
      const response = await fetch("/api/stamps/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profile.userId,
          staffPin: pin,
          newStampCount: newCount,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStampCount(result.stampCount);
        console.log("✅ スタッフによりスタンプ数を変更しました:", result);
        setShowStaffModal(false);
        alert(
          `スタンプ数を更新しました！\n現在 ${result.stampCount} / ${stubStampGoal}個`
        );
        // 最新データを再取得
        await fetchUserData(profile.userId);
      } else {
        console.error("❌ スタンプ数変更失敗:", result.error);
        alert(result.message || "スタンプ数の更新に失敗しました");
      }
    } catch (error) {
      console.error("❌ スタンプ数変更エラー:", error);
      alert("エラーが発生しました");
    } finally {
      setIsStaffLoading(false);
    }
  };

  // 表示用データ
  const displayName = profile?.displayName ?? "ゲスト";
  const displayTicketNumber = ticketNumber ?? "未登録";
  const stubDaysUntilNext = 45;
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
        <div className="space-y-3">
          <p className="text-2xl font-semibold text-gray-800">{displayName}</p>
          <p className="font-mono text-sm text-gray-600">
            診察券番号: {displayTicketNumber}
          </p>
          <p className="text-xs text-gray-500">
            最終アクセス: {formatDate(lastUpdated)}
          </p>
          {/* 予約ボタン */}
          <button
            type="button"
            onClick={handleReservation}
            className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            予約する（アポツール）
          </button>
          {displayTicketNumber === "未登録" && (
            <p className="text-xs text-amber-600">
              ※ 予約には診察券番号の登録が必要です
            </p>
          )}
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
          onScan={async (qrValue) => {
            if (!profile?.userId) {
              alert("ログインしてください");
              return;
            }

            try {
              const result = await addStamp(profile.userId, qrValue);
              if (result.success) {
                setStampCount(result.stampCount || stampCount + 1);
                console.log("✅ スタンプを付与しました:", result);
                alert(`スタンプを取得しました！\n現在 ${result.stampCount} / ${stubStampGoal}個`);
                // 最新データを再取得
                await fetchUserData(profile.userId);
              } else {
                console.error("❌ スタンプ付与失敗:", result.error);
                alert(result.message || "スタンプの登録に失敗しました");
              }
            } catch (error) {
              console.error("❌ スタンプ登録エラー:", error);
              alert("エラーが発生しました");
            }
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
              {stampCount} / {stubStampGoal}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary-dark transition-all"
              style={{
                width: `${Math.min(100, (stampCount / stubStampGoal) * 100)}%`,
              }}
            />
          </div>
          <p className="text-xs text-gray-500">
            あと{stubStampGoal - stampCount}回でごほうび交換可能です
          </p>
        </div>
      </section>

      {/* バージョン情報 */}
      <VersionInfo onTripleTap={() => setShowStaffModal(true)} />

      {/* スタッフ用暗証番号入力モーダル */}
      <StaffPinModal
        isOpen={showStaffModal}
        onClose={() => setShowStaffModal(false)}
        currentStampCount={stampCount}
        onSubmit={handleStaffSubmit}
        isLoading={isStaffLoading}
      />
    </div>
  );
}
