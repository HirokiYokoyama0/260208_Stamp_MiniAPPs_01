"use client";

import { useEffect, useState } from "react";
import { useLiff } from "@/hooks/useLiff";
import { useViewMode } from "@/contexts/ViewModeContext";
import { supabase } from "@/lib/supabase";
import { calculateStampDisplay } from "@/lib/stamps";
import { fetchUserMemo, formatVisitDate } from "@/lib/memo";
import { UserMemo } from "@/types/memo";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * 子供用ホームページ（会員証）
 *
 * デザイン要件:
 * - カラフルな背景（ピンク・イエロー・グリーン）
 * - ハブラーシカのイラストを大きく表示
 * - 丸ゴシックフォント（font-kids）
 * - 大きめのボタン（タップしやすく）
 * - 子供向けメッセージ（例：「はみがき がんばったね！」）
 */

interface Profile {
  id: string;
  display_name: string;
  ticket_number: string | null;
  stamp_count: number;
  total_rewards_redeemed: number;
  last_stamp_at: string | null;
  family_id: string | null;
  family_role: 'parent' | 'child' | null;
  view_mode: 'adult' | 'kids';
  next_visit_date: string | null;
  next_memo: string | null;
}

interface KidsHomeProps {
  profileOverride?: Profile; // 仮想メンバー用のプロフィール上書き
}

export default function KidsHome({ profileOverride }: KidsHomeProps) {
  const { profile: liffProfile, isLoading: liffLoading } = useLiff();
  const { viewMode, selectedChildId, setSelectedChildId, setViewMode } = useViewMode();
  const router = useRouter();
  const [stampCount, setStampCount] = useState(0);
  const [displayName, setDisplayName] = useState("おともだち");
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);
  const [userMemo, setUserMemo] = useState<UserMemo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [familyStampCount, setFamilyStampCount] = useState<number | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  // 親の画面に戻る
  const handleBackToParent = async () => {
    setSelectedChildId(null); // selectedChildIdをクリア
    await setViewMode('adult'); // 大人用モードに切り替え
    router.push('/'); // ホーム画面にリダイレクト
  };

  // プロフィール取得（優先順位: profileOverride > selectedChildId > LIFFユーザー）
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (profileOverride) {
          // 仮想メンバーの場合（props経由）
          setDisplayName(profileOverride.display_name);
          setStampCount(profileOverride.stamp_count);

          setIsLoading(false);
          return;
        }

        if (selectedChildId) {
          // 代理管理メンバーの場合（設定画面から選択）
          console.log(`[KidsHome] selectedChildIdでプロフィール取得: ${selectedChildId}`);
          const { data, error } = await supabase
            .from("profiles")
            .select("stamp_count, display_name, real_name, ticket_number, next_visit_date, next_memo, family_id")
            .eq("id", selectedChildId)
            .single();

          if (error) {
            console.error("❌ 代理管理メンバープロフィール取得エラー:", error);
            setIsLoading(false);
            return;
          }

          if (data) {
            console.log('[KidsHome] データ取得成功:', {
              stamp_count: data.stamp_count,
              display_name: data.display_name,
              ticket_number: data.ticket_number,
              next_visit_date: data.next_visit_date,
              next_memo: data.next_memo,
              family_id: data.family_id,
            });

            setStampCount(data.stamp_count ?? 0);
            setDisplayName(data.real_name || "登録なし");
            setTicketNumber(data.ticket_number);
            setFamilyId(data.family_id);

            // メモ情報を設定
            if (data.next_visit_date || data.next_memo) {
              setUserMemo({
                next_visit_date: data.next_visit_date,
                next_memo: data.next_memo,
                next_memo_updated_at: null, // 代理管理メンバーの場合は更新日時は不要
              });
            }

            // 家族スタンプ数を取得
            if (data.family_id) {
              const { data: familyData, error: familyError } = await supabase
                .from("family_stamp_totals")
                .select("total_stamp_count")
                .eq("family_id", data.family_id)
                .single();

              if (!familyError && familyData) {
                setFamilyStampCount(familyData.total_stamp_count ?? 0);
                console.log("✅ [KidsHome] 家族スタンプ数を取得しました:", familyData.total_stamp_count);
              }
            }
          }

          setIsLoading(false);
          return;
        }

        // 通常のLIFFユーザーの場合
        if (!liffProfile?.userId) return;

        const { data, error } = await supabase
          .from("profiles")
          .select("stamp_count, display_name, ticket_number, family_id")
          .eq("line_user_id", liffProfile.userId)
          .single();

        if (error) {
          console.error("❌ プロフィール取得エラー:", error);
          return;
        }

        if (data) {
          setStampCount(data.stamp_count ?? 0);
          setDisplayName(data.display_name || liffProfile.displayName || "おともだち");
          setTicketNumber(data.ticket_number);
          setFamilyId(data.family_id);

          // 家族スタンプ数を取得
          if (data.family_id) {
            const { data: familyData, error: familyError } = await supabase
              .from("family_stamp_totals")
              .select("total_stamp_count")
              .eq("family_id", data.family_id)
              .single();

            if (!familyError && familyData) {
              setFamilyStampCount(familyData.total_stamp_count ?? 0);
              console.log("✅ [KidsHome] 家族スタンプ数を取得しました:", familyData.total_stamp_count);
            }
          }
        }

        // 次回メモを取得
        const memo = await fetchUserMemo(liffProfile.userId);
        setUserMemo(memo);


      } catch (err) {
        console.error("❌ 予期しないエラー:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [liffProfile, profileOverride, selectedChildId]);

  const { fullStamps } = calculateStampDisplay(stampCount);
  const goalStamps = 10;
  const progressPercent = Math.min(100, (fullStamps / goalStamps) * 100);

  // 励ましメッセージ
  const getEncouragementMessage = () => {
    if (fullStamps >= goalStamps) {
      return "🎉 すごい！10こ たまったよ！";
    } else if (fullStamps >= 7) {
      return "もうすこしで ごほうび だよ！";
    } else if (fullStamps >= 4) {
      return "がんばってるね！";
    } else if (fullStamps >= 1) {
      return "いいちょうし だよ！";
    }
    return "つぎの びょういん まってるよ！";
  };

  // 次回メモのメッセージを生成（子供向け）
  const renderKidsMemoMessage = () => {
    const formattedDate = formatVisitDate(userMemo?.next_visit_date || null);
    const customMemo = userMemo?.next_memo;

    // 日付がある場合
    if (formattedDate) {
      return (
        <>
          つぎの びょういん は
          <span className="font-bold text-kids-purple"> {formattedDate} </span>
          だよ！
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
    return <>まいにち はみがき がんばろうね！</>;
  };

  if (isLoading || (liffLoading && !profileOverride)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-gradient-to-b from-purple-100 via-blue-50 to-sky-100 font-kids">
        <div className="text-center">
          <div className="mb-4 inline-block h-16 w-16 animate-spin rounded-full border-4 border-white border-t-transparent" />
          <p className="text-xl font-bold text-white">よみこみちゅう...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 via-blue-50 to-sky-100 px-4 py-8 font-kids">
      {/* 親の画面に戻るボタン（キッズモードの場合に表示） */}
      {viewMode === 'kids' && (
        <div className="mb-4">
          <button
            onClick={handleBackToParent}
            className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-kids-purple shadow-lg transition-all hover:bg-white active:scale-95"
          >
            <ArrowLeft size={20} />
            おやの がめんに もどる
          </button>
        </div>
      )}

      {/* ハブラーシカ */}
      <div className="mb-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/haburasika２.png"
          alt="ハブラーシカ"
          width={120}
          height={120}
          className="mx-auto drop-shadow-lg"
        />
        <h2 className="mt-4 text-3xl font-bold text-white drop-shadow-lg">
          こんにちは！
        </h2>
        <p className="mt-2 text-xl font-bold text-white drop-shadow-md">
          {displayName}さん
        </p>
      </div>

      {/* 会員証カード */}
      <div className="mx-auto max-w-md rounded-3xl border-4 border-white bg-white p-5 shadow-2xl mb-6">
        <h3 className="mb-3 text-center text-2xl font-bold text-kids-blue">
          🦷 しんさつけん
        </h3>
        <div className="space-y-3">
          <div className="rounded-xl bg-kids-yellow/20 p-3">
            <p className="text-sm text-gray-600 mb-1">なまえ</p>
            <p className="text-xl font-bold text-gray-800">{displayName}さん</p>
          </div>
          <div className="rounded-xl bg-kids-pink/20 p-3">
            <p className="text-sm text-gray-600 mb-1">しんさつけん ばんごう</p>
            <p className="text-lg font-bold font-mono text-gray-800">
              {ticketNumber || "みとうろく"}
            </p>
          </div>
        </div>
      </div>

      {/* 家族スタンプ合計（家族に参加している場合のみ表示） */}
      {familyId && familyStampCount !== null && (
        <div className="mx-auto max-w-md rounded-3xl border-4 border-white bg-gradient-to-br from-kids-purple to-kids-pink p-5 shadow-2xl mb-6">
          <h3 className="mb-3 text-center text-2xl font-bold text-white drop-shadow-md">
            👨‍👩‍👧‍👦 かぞくの スタンプ
          </h3>
          <div className="rounded-xl bg-white/90 p-4">
            <p className="text-sm text-gray-600 mb-2 text-center">
              かぞくみんなで あつめた スタンプ
            </p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-5xl font-bold text-kids-purple">
                {familyStampCount}
              </span>
              <span className="text-2xl text-gray-600">こ</span>
            </div>
            <p className="mt-3 text-center text-sm font-bold text-kids-purple">
              みんなで がんばろう！🌟
            </p>
          </div>
        </div>
      )}

      {/* ハブラーシカのメッセージ */}
      {(userMemo?.next_visit_date || userMemo?.next_memo) && (
        <div className="mx-auto max-w-md rounded-3xl border-4 border-white bg-white p-5 shadow-2xl mb-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-kids-blue/20 flex items-center justify-center">
                <span className="text-2xl">🦷</span>
              </div>
            </div>
            <div className="flex-1 pt-2">
              <p className="text-base text-gray-700 leading-relaxed">
                {renderKidsMemoMessage()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* スタンプカード */}
      <div className="mx-auto max-w-md rounded-3xl border-4 border-white bg-white p-6 shadow-2xl">
        <h3 className="mb-4 text-center text-2xl font-bold text-kids-purple">
          🦷 スタンプカード
        </h3>

        {/* スタンプ表示（10個のマス） */}
        <div className="mb-4 grid grid-cols-5 gap-3">
          {Array.from({ length: goalStamps }).map((_, i) => (
            <div
              key={i}
              className={`flex h-14 w-14 items-center justify-center rounded-xl border-4 text-3xl transition-all ${
                i < fullStamps
                  ? "border-kids-green bg-kids-green/20 shadow-md"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              {i < fullStamps ? "⭐" : ""}
            </div>
          ))}
        </div>

        {/* 進捗バー */}
        <div className="mb-4">
          <div className="h-6 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-kids-pink to-kids-purple transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-center text-xl font-bold text-kids-blue">
            {fullStamps} / {goalStamps}こ
          </p>
        </div>

        {/* 励ましメッセージ */}
        <div className="rounded-2xl bg-kids-yellow/20 p-4 text-center">
          <p className="text-lg font-bold text-kids-purple">
            {getEncouragementMessage()}
          </p>
        </div>
      </div>

      {/* メッセージ */}
      <div className="mt-6 text-center">
        <p className="text-lg font-bold text-white drop-shadow-md">
          まいにち はみがき がんばろうね！
        </p>
      </div>
    </div>
  );
}
