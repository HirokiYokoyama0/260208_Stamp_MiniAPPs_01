"use client";

import { useEffect, useState } from "react";
import { useLiff } from "@/hooks/useLiff";
import { useViewMode } from "@/contexts/ViewModeContext";
import Image from "next/image";
import {
  fetchStampCount,
  fetchStampHistory,
  calculateStampDisplay,
  formatStampDate,
} from "@/lib/stamps";
import { StampHistoryRecord } from "@/types/stamp";
import { supabase } from "@/lib/supabase";

const STAMP_GOAL = 10;

/**
 * 子供用スタンプページ
 * - selectedChildIdが設定されている場合：その子供のスタンプ情報を表示
 * - 設定されていない場合：LIFFユーザーのスタンプ情報を表示
 */
export default function KidsStampPage() {
  const { profile: liffProfile } = useLiff();
  const { selectedChildId } = useViewMode();
  const [stampCount, setStampCount] = useState(0);
  const [stampHistory, setStampHistory] = useState<StampHistoryRecord[]>([]);
  const [displayName, setDisplayName] = useState("おともだち");
  const [isLoading, setIsLoading] = useState(true);

  // プロフィールIDを決定（優先順位: selectedChildId > LIFFユーザー）
  const profileId = selectedChildId || liffProfile?.userId;

  console.log('[KidsStampPage] 初期化:', {
    selectedChildId,
    liffUserId: liffProfile?.userId,
    profileId,
  });

  // スタンプ履歴とカウント数を取得
  const fetchData = async () => {
    if (!profileId) return;

    setIsLoading(true);
    try {
      // selectedChildIdがある場合はid列で検索、ない場合はline_user_id列で検索
      let userId = profileId;

      if (selectedChildId) {
        // 代理管理メンバー（manual-で始まるID）の場合、idで直接検索
        console.log(`[KidsStampPage] 代理管理メンバーのスタンプ情報取得: ${selectedChildId}`);

        // プロフィール情報を取得
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("display_name, stamp_count")
          .eq("id", selectedChildId)
          .single();

        if (profileError) {
          console.error("❌ プロフィール取得エラー:", profileError);
        } else if (profileData) {
          setDisplayName(profileData.display_name || "おともだち");
          setStampCount(profileData.stamp_count ?? 0);
        }

        userId = selectedChildId;
      } else {
        // 通常のLIFFユーザーの場合
        const count = await fetchStampCount(profileId);
        setStampCount(count);

        if (liffProfile?.displayName) {
          setDisplayName(liffProfile.displayName);
        }
      }

      // 履歴を取得
      const history = await fetchStampHistory(userId);
      setStampHistory(history);

      console.log(`✅ スタンプ情報取得成功:`, {
        userId,
        stampCount,
        historyCount: history.length,
      });
    } catch (error) {
      console.error("❌ スタンプ情報の取得エラー:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // プロフィールIDが変わったら再取得
  useEffect(() => {
    if (profileId) {
      fetchData();
    }
  }, [profileId, selectedChildId]);

  const { fullStamps } = calculateStampDisplay(stampCount);
  const progressPercent = Math.min(100, (fullStamps / STAMP_GOAL) * 100);

  // 励ましメッセージ
  const getEncouragementMessage = () => {
    if (fullStamps >= STAMP_GOAL) {
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

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-gradient-to-br from-kids-pink via-kids-yellow to-kids-blue px-4 py-6 font-kids">
        <div className="text-center">
          <div className="mb-4 inline-block h-16 w-16 animate-spin rounded-full border-4 border-white border-t-transparent" />
          <p className="text-xl font-bold text-white">よみこみちゅう...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-kids-pink via-kids-yellow to-kids-blue px-4 py-6 font-kids">
      {/* ハブラーシカ */}
      <div className="mb-6 text-center">
        <Image
          src="/images/haburashika.jpg"
          alt="ハブラーシカ"
          width={100}
          height={100}
          className="mx-auto rounded-full border-4 border-white shadow-2xl"
        />
        <h2 className="mt-3 text-2xl font-bold text-white drop-shadow-lg">
          {displayName}さんの スタンプ
        </h2>
      </div>

      {/* スタンプカード */}
      <div className="mx-auto max-w-md rounded-3xl border-4 border-white bg-white p-6 shadow-2xl">
        <h3 className="mb-4 text-center text-2xl font-bold text-kids-purple">
          🦷 スタンプカード
        </h3>

        {/* スタンプ表示（10個のマス） */}
        <div className="mb-4 grid grid-cols-5 gap-3">
          {Array.from({ length: STAMP_GOAL }).map((_, i) => (
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
            {fullStamps} / {STAMP_GOAL}こ
          </p>
        </div>

        {/* 励ましメッセージ */}
        <div className="rounded-2xl bg-kids-yellow/20 p-4 text-center">
          <p className="text-lg font-bold text-kids-purple">
            {getEncouragementMessage()}
          </p>
        </div>
      </div>

      {/* 来院履歴 */}
      <div className="mt-6 rounded-3xl border-4 border-white bg-white p-5 shadow-2xl">
        <h3 className="mb-4 text-center text-xl font-bold text-kids-purple">
          📅 びょういんに きた ひ
        </h3>
        {stampHistory.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-base font-bold text-gray-400">
              まだ びょういんに きてないよ
            </p>
            <p className="mt-2 text-sm text-gray-400">
              つぎ きたとき スタンプが もらえるよ！
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {stampHistory.slice(0, 5).map((record, index) => {
              const visitNumber = stampHistory.length - index;
              const { fullStamps: recordStamps } = calculateStampDisplay(
                record.stamp_number
              );
              return (
                <li
                  key={record.id}
                  className="flex items-center gap-3 rounded-xl border-2 border-kids-blue/20 bg-kids-blue/5 p-3"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-kids-green/20 text-2xl">
                    ⭐
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-bold text-kids-purple">
                      {visitNumber}かいめ
                    </p>
                    <p className="text-sm text-gray-600">
                      {formatStampDate(record.visit_date)}
                    </p>
                    <p className="text-xs text-kids-blue">
                      スタンプ {recordStamps}こ もらったよ！
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {stampHistory.length > 5 && (
          <p className="mt-4 text-center text-sm text-gray-500">
            さいきんの 5かいぶんを ひょうじしています
          </p>
        )}
      </div>

      {/* メッセージ */}
      <div className="mt-6 text-center">
        <p className="text-lg font-bold text-white drop-shadow-md">
          つぎも まってるよ！がんばってね！
        </p>
      </div>
    </div>
  );
}
