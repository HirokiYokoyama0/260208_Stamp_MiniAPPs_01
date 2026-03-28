"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiff } from "@/hooks/useLiff";
import { QRScanner } from "@/components/shared/QRScanner";
import { VersionInfo } from "@/components/layout/VersionInfo";
import { StaffPinModal } from "@/components/shared/StaffPinModal";
import { BirthMonthPromptModal } from "@/components/shared/BirthMonthPromptModal";
import { Smile } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { addStamp, fetchStampCount, calculateStampDisplay, calculateNextGoal, getStampProgress } from "@/lib/stamps";
import { fetchUserMemo, formatVisitDate } from "@/lib/memo";
import { UserMemo } from "@/types/memo";
import { logReservationClick, logEvent } from "@/lib/analytics";

export default function AdultHome() {
  const router = useRouter();
  const { isInitialized, isLoggedIn, isLoading, profile, login } = useLiff();
  const [stampCount, setStampCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [isStaffLoading, setIsStaffLoading] = useState(false);
  const [userMemo, setUserMemo] = useState<UserMemo | null>(null);
  const [familyStampCount, setFamilyStampCount] = useState<number | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [realName, setRealName] = useState<string | null>(null);
  const [birthMonth, setBirthMonth] = useState<number | null>(null);
  const [showBirthMonthModal, setShowBirthMonthModal] = useState(false);
  const [familyRole, setFamilyRole] = useState<string | null>(null);

  // Supabaseからユーザーデータを取得
  const fetchUserData = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("stamp_count, updated_at, ticket_number, family_id, real_name, family_role, birth_month")
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
        setBirthMonth(data.birth_month);
        setFamilyId(data.family_id);
        setRealName(data.real_name);
        setFamilyRole(data.family_role);
        console.log("✅ ユーザーデータを取得しました:", {
          stampCount: data.stamp_count,
          updatedAt: data.updated_at,
          ticketNumber: data.ticket_number,
          familyId: data.family_id,
          realName: data.real_name,
          familyRole: data.family_role,
        });

        // 家族に所属している場合、家族全体のスタンプ数を取得
        if (data.family_id) {
          const { data: familyData, error: familyError } = await supabase
            .from("family_stamp_totals")
            .select("total_stamp_count")
            .eq("family_id", data.family_id)
            .single();

          if (!familyError && familyData) {
            setFamilyStampCount(familyData.total_stamp_count ?? 0);
            console.log("✅ 家族スタンプ数を取得しました:", familyData.total_stamp_count);
          } else {
            console.log("⚠️  家族スタンプ数の取得に失敗:", familyError);
            setFamilyStampCount(null);
          }
        } else {
          setFamilyStampCount(null);
        }
      }

      // 次回メモを取得
      const memo = await fetchUserMemo(userId);
      setUserMemo(memo);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, profile?.userId]);

  // 初回ユーザー（family_role が NULL かつ初回表示）を設定画面へ誘導
  // ただし、単身ユーザーとして利用する場合は family_role = NULL のまま維持
  useEffect(() => {
    // 初回アクセスかどうかのフラグをローカルストレージで管理
    const hasSeenFamilySetup = localStorage.getItem('hasSeenFamilySetup');

    if (familyRole === null && profile?.userId && !isLoading && !hasSeenFamilySetup) {
      console.log('[AdultHome] 初回ユーザー検出 → /settings にリダイレクト');
      localStorage.setItem('hasSeenFamilySetup', 'true');

  // 誕生月未登録ユーザーにモーダル表示（1日1回まで）
  useEffect(() => {
    if (!profile?.userId || birthMonth !== null) return;

    // 今日既に表示したかチェック
    const today = new Date().toISOString().split('T')[0];
    const lastPrompt = localStorage.getItem('birthMonthPrompt_lastShown');
    
    if (lastPrompt === today) {
      return; // 今日既に表示済み
    }

    // スキップした日もチェック
    const lastSkip = localStorage.getItem('birthMonthPrompt_lastSkip');
    if (lastSkip === today) {
      return; // 今日スキップ済み
    }

    // 2秒後にモーダル表示
    const timer = setTimeout(() => {
      setShowBirthMonthModal(true);
      localStorage.setItem('birthMonthPrompt_lastShown', today);
    }, 2000);

    return () => clearTimeout(timer);
  }, [profile?.userId, birthMonth]);
      router.push('/settings');
    }
  }, [familyRole, profile?.userId, isLoading, router]);

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
    console.log("🔍 [DEBUG] handleReservation called", {
      displayTicketNumber,
      "profile?.userId": profile?.userId,
      profile: profile
    });

    if (displayTicketNumber === "未登録") {
      alert("診察券番号が登録されていません。受付でご登録をお願いします。");
      return;
    }

    // 🆕 予約ボタンのクリック数をカウント
    if (profile?.userId) {
      const url = `/api/users/${profile.userId}/reservation-click`;
      console.log("📊 [DEBUG] クリックカウントAPI呼び出し:", url);
      fetch(url, {
        method: "POST",
      })
        .then((res) => {
          console.log("✅ [DEBUG] API レスポンス status:", res.status);
          return res.json();
        })
        .then((data) => {
          console.log("✅ [DEBUG] API レスポンスボディ:", data);
        })
        .catch((error) => {
          // エラーでもユーザー体験は妨げない
          console.error("⚠️ クリックカウントエラー:", error);
        });

      // 🆕 イベントログも記録
      logReservationClick({
        fromPage: '/',
        currentStampCount: stampCount,
        userId: profile.userId,
      });
    } else {
      console.warn("⚠️ [DEBUG] profile.userId が存在しません", { profile });
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
        // APIレスポンスの値を直接使用（fetchUserDataは呼ばない）
        setStampCount(result.stampCount);
        setLastUpdated(new Date().toISOString());
        console.log("✅ スタッフによりスタンプ数を変更しました:", result);
        setShowStaffModal(false);
        const { fullStamps: updatedStamps } = calculateStampDisplay(result.stampCount);
        alert(
          `スタンプ数を更新しました！\n現在 ${updatedStamps}個`
        );
        // fetchUserDataは呼ばない（データベースのレプリカ遅延で古い値を取得する可能性があるため）
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
  const displayName = realName || (profile?.displayName ?? "ゲスト");
  const displayTicketNumber = ticketNumber ?? "未登録";
  const stubStampGoal = 10;

  // 10倍整数システム対応のスタンプ表示
  const { fullStamps, progress } = calculateStampDisplay(stampCount);

  // 次回メモの表示内容を生成
  const renderMemoMessage = () => {
    const formattedDate = formatVisitDate(userMemo?.next_visit_date || null);
    const customMemo = userMemo?.next_memo;

    // 日付がある場合
    if (formattedDate) {
      return (
        <>
          次回の定期検診は
          <span className="font-semibold text-primary-dark">
            {formattedDate}
          </span>
          です。
          {customMemo && (
            <>
              <br />
              {customMemo}
            </>
          )}
        </>
      );
    }

    // 日付がなく、カスタムメモがある場合
    if (customMemo) {
      return <>{customMemo}</>;
    }

    // どちらもない場合（デフォルトメッセージ）
    return <>次回のご来院をお待ちしております。毎日の歯磨き、頑張りましょう！</>;
  };

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
          デジタル会員証をご利用ください
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
    <div className="space-y-7 px-4 py-6">
      {/* デジタル会員証カード */}
      <section className="rounded-xl border border-gray-100 bg-gradient-to-br from-white to-gray-50/50 p-5 shadow-sm">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-gray-400">
          デジタル会員証
        </h2>
        <div className="space-y-3">
          <p className="text-2xl font-semibold text-gray-800">{displayName}</p>
          {realName && realName !== profile?.displayName && (
            <p className="text-xs text-gray-400">
              LINE表示名: {profile?.displayName}
            </p>
          )}
          <p className="font-mono text-sm text-gray-600">
            診察券番号: {displayTicketNumber}
          </p>
          <p className="text-xs text-gray-500">
            最終アクセス: {formatDate(lastUpdated)}
          </p>
        </div>
      </section>

      {/* 予約ボタン（独立セクション） */}
      <section className="px-2">
        <button
          type="button"
          onClick={() => {
            console.log("🔴 [DEBUG] Button clicked!");
            handleReservation();
          }}
          className="w-full rounded-lg bg-primary px-6 py-2.5 font-bold text-white shadow-md transition-all hover:bg-primary-dark hover:shadow-lg active:scale-[0.98]"
        >
          <span className="text-base">予約する</span>
          <span className="text-xs">（アポツール）</span>
        </button>
        {displayTicketNumber === "未登録" && (
          <p className="mt-3 text-center text-xs text-amber-600">
            ※ 予約には診察券番号の登録が必要です
          </p>
        )}
      </section>

      {/* ハブラーシカのメッセージ */}
      <section className="flex items-start gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/20">
          <Smile size={24} className="text-primary-dark" strokeWidth={1.5} />
        </div>
        <div className="flex-1 pt-1">
          <p className="text-sm text-gray-700">{renderMemoMessage()}</p>
        </div>
      </section>

      {/* 来院スタンプボタン */}
      <section className="px-2">
        <QRScanner
          className="w-full bg-gray-100 text-gray-700 hover:bg-gray-200 py-2.5 text-xs font-medium"
          onScan={async (qrValue) => {
            if (!profile?.userId) {
              alert("ログインしてください");
              return;
            }

            try {
              const result = await addStamp(profile.userId, qrValue);
              if (result.success) {
                // APIレスポンスの値を直接使用
                setStampCount(result.stampCount || stampCount + 1);
                setLastUpdated(new Date().toISOString());
                console.log("✅ スタンプを付与しました:", result);
                const { fullStamps: updatedStamps } = calculateStampDisplay(result.stampCount || stampCount + 1);
                alert(`スタンプを取得しました！\n現在 ${updatedStamps}個`);
                // fetchUserDataは呼ばない（レプリカ遅延で古い値を取得する可能性があるため）
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
          現在のスタンプ数
        </h2>
        <div className="space-y-4">
          {/* 個人のスタンプ数 */}
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">あなたのスタンプ</p>
              <p className="text-4xl font-bold text-primary">{fullStamps}個</p>
            </div>

            {/* プログレスバー（100個単位） */}
            {(() => {
              const nextGoal = calculateNextGoal(fullStamps);
              const progress = getStampProgress(fullStamps, nextGoal);
              return (
                <>
                  <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary-dark transition-all"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    次の目標まであと{progress.remaining}個（目標: {nextGoal}個）
                  </p>
                </>
              );
            })()}
          </div>

          {/* 家族全体のスタンプ数（家族に所属している場合のみ表示） */}
          {familyId && familyStampCount !== null && (() => {
            const familyStamps = calculateStampDisplay(familyStampCount).fullStamps;
            const familyNextGoal = calculateNextGoal(familyStamps);
            const familyProgress = getStampProgress(familyStamps, familyNextGoal);
            return (
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">家族全体のスタンプ</p>
                  <p className="text-4xl font-bold text-purple-600">{familyStamps}個</p>
                </div>

                {/* プログレスバー（100個単位） */}
                <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-400 to-purple-600 transition-all"
                    style={{ width: `${familyProgress.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 text-center">
                  次の目標まであと{familyProgress.remaining}個（目標: {familyNextGoal}個）
                </p>
                <p className="text-xs text-gray-500 text-center">
                  家族みんなで協力してスタンプを貯めよう！
                </p>
              </div>
            );
          })()}
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
        userId={profile?.userId}

      />
      {/* 誕生月登録促進モーダル */}
      <BirthMonthPromptModal
        isOpen={showBirthMonthModal}
        onClose={() => setShowBirthMonthModal(false)}
        userId={profile?.userId || ''}
        onSuccess={async () => {
          // 登録成功後、ユーザーデータを再取得
          if (profile?.userId) {
            await fetchUserData(profile.userId);
          }
        }}
      />
    </div>
  );
}
