"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useLiff } from "@/hooks/useLiff";
import { useViewMode } from "@/contexts/ViewModeContext";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera } from "lucide-react";
import {
  fetchStampCount,
  fetchStampHistory,
  calculateStampDisplay,
  formatStampDate,
} from "@/lib/stamps";
import { StampHistoryRecord } from "@/types/stamp";
import { supabase } from "@/lib/supabase";
import { StaffPinModal } from "@/components/shared/StaffPinModal";
import liff from "@line/liff";

const STAMP_GOAL = 10;

/**
 * 子供用スタンプページ
 * - selectedChildIdが設定されている場合：その子供のスタンプ情報を表示
 * - 設定されていない場合：LIFFユーザーのスタンプ情報を表示
 */
export default function KidsStampPage() {
  const { profile: liffProfile } = useLiff();
  const { viewMode, selectedChildId, setSelectedChildId, setViewMode } = useViewMode();
  const router = useRouter();
  const [stampCount, setStampCount] = useState(0);
  const [stampHistory, setStampHistory] = useState<StampHistoryRecord[]>([]);
  const [displayName, setDisplayName] = useState("おともだち");
  const [isLoading, setIsLoading] = useState(true);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [isStaffLoading, setIsStaffLoading] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [slotUnlocked, setSlotUnlocked] = useState(false);
  const [slotUnlockLoading, setSlotUnlockLoading] = useState(false);
  const [slotUnlockMessage, setSlotUnlockMessage] = useState<string | null>(null);

  // スロット解放済みか確認（event_logsテーブル）
  const checkSlotUnlock = useCallback(async (userId: string) => {
    try {
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000;
      const jstNow = new Date(now.getTime() + jstOffset);
      const todayStart = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());
      const todayStartUTC = new Date(todayStart.getTime() - jstOffset).toISOString();

      const { data } = await supabase
        .from("event_logs")
        .select("id")
        .eq("user_id", userId)
        .eq("event_name", "slot_unlock")
        .gte("created_at", todayStartUTC)
        .limit(1);

      if (data && data.length > 0) {
        setSlotUnlocked(true);
      }
    } catch { /* ignore */ }
  }, []);

  // QRスキャンでスロット解放
  const handleSlotUnlockScan = useCallback(async () => {
    const targetId = selectedChildId ?? liffProfile?.userId;
    if (!targetId) return;

    setSlotUnlockLoading(true);
    setSlotUnlockMessage(null);

    try {
      const scanResult = await liff.scanCodeV2();
      const qrValue = scanResult.value;
      if (!qrValue) {
        setSlotUnlockMessage("QRコードを よみとれなかったよ");
        setSlotUnlockLoading(false);
        return;
      }

      let payload: { type?: string };
      try {
        payload = JSON.parse(qrValue);
      } catch {
        setSlotUnlockMessage("このQRコードは つかえないよ");
        setSlotUnlockLoading(false);
        return;
      }

      if (payload.type !== "slot-unlock") {
        setSlotUnlockMessage("このQRコードは つかえないよ");
        setSlotUnlockLoading(false);
        return;
      }

      const res = await fetch("/api/slot/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetId }),
      });
      const data = await res.json();

      if (data.success) {
        setSlotUnlocked(true);
        setSlotUnlockMessage(data.alreadyUnlocked ? "もう かいほうずみ だよ！" : "🎰 ゲーム かいほう！あそべるよ！");
      } else {
        setSlotUnlockMessage(data.message || "かいほうに しっぱいしました");
      }
    } catch {
      setSlotUnlockMessage("QRコードを よみとれなかったよ");
    } finally {
      setSlotUnlockLoading(false);
    }
  }, [selectedChildId, liffProfile?.userId]);

  // 親の画面に戻る
  const handleBackToParent = async () => {
    setSelectedChildId(null);
    await setViewMode('adult');
    router.push('/');
  };

  // 3回タップ検出（スタッフ操作モード起動）
  const handleTripleTap = () => {
    tapCountRef.current += 1;
    console.log(`[KidsStampPage] タップ検出 (${tapCountRef.current}/3)`);

    // タイマーをクリア
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
    }

    // 3回タップでスタッフモーダルを開く
    if (tapCountRef.current >= 3) {
      console.log('[KidsStampPage] スタッフ操作モード起動（3回タップ検出）');
      alert('スタッフモード起動'); // デバッグ用
      setShowStaffModal(true);
      tapCountRef.current = 0;
      return;
    }

    // 1秒以内に次のタップがなければリセット
    tapTimerRef.current = setTimeout(() => {
      console.log('[KidsStampPage] タップカウントをリセット');
      tapCountRef.current = 0;
    }, 1000);
  };

  // スタッフ暗証番号による手動スタンプ数変更
  const handleStaffSubmit = async (pin: string, newCount: number) => {
    if (!profileId) {
      alert("ユーザー情報が取得できませんでした");
      return;
    }

    setIsStaffLoading(true);
    try {
      const response = await fetch("/api/stamps/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profileId,
          staffPin: pin,
          newStampCount: newCount,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStampCount(result.stampCount);
        console.log("✅ スタッフによりスタンプ数を変更しました:", result);
        setShowStaffModal(false);
        const { fullStamps: updatedStamps } = calculateStampDisplay(result.stampCount);
        alert(`スタンプ数を更新しました！\n現在 ${updatedStamps}個`);
        // データを再取得
        fetchData();
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
      checkSlotUnlock(profileId);
    }
  }, [profileId, selectedChildId, checkSlotUnlock]);

  const { fullStamps } = calculateStampDisplay(stampCount);

  // サイクル計算（10こで1周）
  const currentCycleStamps = fullStamps % STAMP_GOAL; // 現在サイクルの進捗 (0-9)
  const completedCycles = Math.floor(fullStamps / STAMP_GOAL); // 完了した周回数
  const remaining = currentCycleStamps === 0 ? STAMP_GOAL : STAMP_GOAL - currentCycleStamps;
  const cyclePercent = (currentCycleStamps / STAMP_GOAL) * 100;

  // 励ましメッセージ（サイクル内の残り数で判定）
  const getEncouragementMessage = () => {
    if (fullStamps === 0) return "つぎの びょういん まってるよ！";
    if (remaining <= 1)   return "あと もうすこし！すごいよ！";
    if (remaining <= 3)   return "もうすこしで ごほうびだよ！";
    if (currentCycleStamps >= 5) return "いいちょうし！がんばれ！";
    return "がんばってるね！";
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-gradient-to-b from-purple-100 via-blue-50 to-sky-100 px-4 py-6 font-kids">
        <div className="text-center">
          <div className="mb-4 inline-block h-16 w-16 animate-spin rounded-full border-4 border-white border-t-transparent" />
          <p className="text-xl font-bold text-white">よみこみちゅう...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-purple-100 via-blue-50 to-sky-100 px-4 py-6 font-kids"
      onClick={handleTripleTap}
    >
      {/* 親の画面に戻るボタン（キッズモードの場合に表示） */}
      {viewMode === 'kids' && (
        <div className="mb-4">
          <button
            onClick={(e) => {
              e.stopPropagation(); // 親要素へのイベント伝播を止める
              handleBackToParent();
            }}
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
          src="/images/はぶらしか正式.png"
          alt="ハブラーシカ"
          width={120}
          height={120}
          className="mx-auto drop-shadow-lg"
        />
        <h2 className="mt-3 text-2xl font-bold text-white drop-shadow-lg">
          {displayName}さんの スタンプ
        </h2>
      </div>

      {/* スロットゲーム解放 */}
      <div className="mx-auto max-w-md mb-6">
        {slotUnlocked ? (
          <div className="rounded-3xl border-4 border-white bg-gradient-to-br from-orange-50 to-yellow-50 p-5 shadow-2xl text-center">
            <Link
              href="/slot"
              className="inline-block rounded-full bg-gradient-to-r from-kids-pink to-kids-purple px-8 py-4 text-2xl font-bold text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              🎰 ゲームで あそぶ！
            </Link>
            <p className="mt-2 text-xs text-gray-500">
              2かい あそべるよ！とくてんが たかいほうが スタンプになるよ！
            </p>
          </div>
        ) : (
          <div className="rounded-3xl border-4 border-white bg-white p-5 shadow-2xl text-center">
            <button
              onClick={handleSlotUnlockScan}
              disabled={slotUnlockLoading}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-kids-blue to-kids-green px-6 py-3 text-lg font-bold text-white shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <Camera size={22} />
              {slotUnlockLoading ? "よみとりちゅう..." : "📷 QRをよんで ゲームかいほう！"}
            </button>
            <p className="mt-2 text-xs text-gray-500">
              びょういんに いくと ゲームで あそべるよ！
            </p>
          </div>
        )}
        {slotUnlockMessage && (
          <p className="mt-3 rounded-xl bg-white/90 px-4 py-2 text-center text-base font-bold text-kids-purple shadow-lg">
            {slotUnlockMessage}
          </p>
        )}
      </div>

      {/* スタンプカード */}
      <div className="mx-auto max-w-md rounded-3xl border-4 border-white bg-white p-6 shadow-2xl">
        <h3 className="mb-5 text-center text-2xl font-bold text-kids-purple">
          🦷 スタンプカード
        </h3>

        {/* ① きみのスタンプ総数 */}
        <div className="mb-5 rounded-2xl bg-gradient-to-br from-kids-pink/20 to-kids-yellow/20 py-4 text-center">
          <p className="text-sm font-bold text-kids-purple">きみの スタンプ</p>
          <div className="flex items-end justify-center gap-1 mt-1">
            <span className="text-7xl font-black leading-none text-kids-pink">
              {fullStamps}
            </span>
            <span className="mb-2 text-2xl font-bold text-kids-purple">こ</span>
          </div>
          <p className="mt-1 text-sm font-bold text-kids-blue">あつめたよ！🌟</p>
        </div>

        {/* ② つぎのごほうびまでの進捗 */}
        <div className="mb-5">
          <p className="mb-3 text-center text-sm font-bold text-gray-600">
            つぎの ごほうびまで あと
            <span className="mx-1 text-2xl font-black text-kids-pink">{remaining}</span>
            こ！
          </p>
          {/* 10ドット進捗インジケーター */}
          <div className="mb-2 flex justify-center gap-2">
            {Array.from({ length: STAMP_GOAL }).map((_, i) => (
              <div
                key={i}
                className={`h-7 w-7 rounded-full transition-all duration-300 ${
                  i < currentCycleStamps
                    ? "scale-110 bg-gradient-to-b from-kids-pink to-kids-purple shadow-md"
                    : "bg-gray-200"
                }`}
              />
            ))}
          </div>
          {/* プログレスバー */}
          <div className="h-4 overflow-hidden rounded-full bg-gray-100 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-kids-pink to-kids-purple transition-all duration-500"
              style={{ width: `${cyclePercent}%` }}
            />
          </div>
          <p className="mt-1.5 text-center text-xs text-gray-400">
            {currentCycleStamps} / {STAMP_GOAL}こ
          </p>
        </div>

        {/* ③ 達成バッジ（完了サイクル数） or 励ましメッセージ */}
        {completedCycles > 0 ? (
          <div className="rounded-2xl bg-kids-yellow/20 p-4 text-center">
            <p className="mb-2 text-xs font-bold text-gray-500">
              これまで ごほうびを もらったよ！
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1">
              {Array.from({ length: Math.min(completedCycles, 5) }).map((_, i) => (
                <span key={i} className="text-3xl">🏆</span>
              ))}
              {completedCycles > 5 && (
                <span className="text-xl font-black text-kids-purple">
                  +{completedCycles - 5}
                </span>
              )}
            </div>
            <p className="mt-2 text-base font-black text-orange-500">
              {completedCycles}かい ゲット！🎉
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-kids-yellow/20 p-4 text-center">
            <p className="text-lg font-bold text-kids-purple">
              {getEncouragementMessage()}
            </p>
          </div>
        )}
      </div>

      {/* スタンプ履歴（大人版と同じ3行構造） */}
      <div className="mt-6 rounded-3xl border-4 border-white bg-white p-5 shadow-2xl">
        <h3 className="mb-4 text-center text-xl font-bold text-kids-purple">
          🌟 スタンプ りれき
        </h3>
        {stampHistory.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-base font-bold text-gray-400">
              まだ スタンプが ないよ
            </p>
            <p className="mt-2 text-sm text-gray-400">
              びょういんに いったら もらえるよ！
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {stampHistory.map((record) => {
              const { fullStamps: recordStamps } = calculateStampDisplay(record.stamp_number);
              const acquiredAmount = record.amount ?? 0;

              // スタンプ取得方法の絵文字・ラベル・背景色（子供向け）
              const methodInfo: Record<string, { emoji: string; label: string; bg: string }> = {
                qr:                 { emoji: "📍", label: "らいいん で きたよ！",     bg: "bg-kids-blue/15" },
                qr_scan:            { emoji: "🏥", label: "びょういん に きたよ！",   bg: "bg-kids-blue/15" },
                purchase_incentive: { emoji: "🛒", label: "おかいもの で ゲット！", bg: "bg-kids-purple/15" },
                slot_game:          { emoji: "🎰", label: "スロット で ゲット！",      bg: "bg-kids-pink/15" },
                survey_reward:      { emoji: "📝", label: "アンケート ほうしゅう",    bg: "bg-kids-green/15" },
                manual_admin:       { emoji: "👨‍⚕️", label: "せんせい から",         bg: "bg-kids-yellow/30" },
                import:             { emoji: "📦", label: "でーた いどう",           bg: "bg-gray-100" },
              };
              const method = methodInfo[record.stamp_method] ?? {
                emoji: "❓", label: "ふめい", bg: "bg-gray-100",
              };

              return (
                <li
                  key={record.id}
                  className="flex items-center gap-3 rounded-xl border-2 border-kids-blue/20 bg-kids-blue/5 p-3 transition-colors"
                >
                  {/* アイコン（大人版と同じ構造） */}
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-2xl ${method.bg}`}>
                    {method.emoji}
                  </div>
                  {/* テキスト（大人版と同じ3行構造） */}
                  <div className="flex-1">
                    <p className="text-base font-bold text-kids-purple">
                      +{acquiredAmount}こ ゲット！（ぜんぶで {recordStamps}こ）
                    </p>
                    <p className="text-sm font-medium text-kids-blue">
                      {method.label}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatStampDate(record.visit_date)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* メッセージ */}
      <div className="mt-6 text-center">
        <p className="text-lg font-bold text-white drop-shadow-md">
          まいにち はみがき がんばろうね！
        </p>
      </div>

      {/* スタッフPINモーダル */}
      <StaffPinModal
        isOpen={showStaffModal}
        onClose={() => setShowStaffModal(false)}
        currentStampCount={stampCount}
        onSubmit={handleStaffSubmit}
        isLoading={isStaffLoading}
        userId={profileId}
      />
    </div>
  );
}
