import { supabase } from "./supabase";
import {
  StampHistoryRecord,
  AddStampResponse,
  StampProgress,
} from "@/types/stamp";

/**
 * ユーザーのスタンプ履歴を取得
 * @param userId LINEユーザーID
 * @returns スタンプ履歴の配列（新しい順）
 */
export const fetchStampHistory = async (
  userId: string
): Promise<StampHistoryRecord[]> => {
  try {
    const { data, error } = await supabase
      .from("stamp_history")
      .select("*")
      .eq("user_id", userId)
      .order("visit_date", { ascending: false });

    if (error) {
      console.error("❌ スタンプ履歴の取得に失敗しました:", error);
      return [];
    }

    return (data as StampHistoryRecord[]) || [];
  } catch (err) {
    console.error("❌ 予期しないエラー:", err);
    return [];
  }
};

/**
 * スタンプ登録APIを呼び出す
 * @param userId LINEユーザーID
 * @param qrCodeId QRコードから読み取った値
 * @returns APIレスポンス
 */
export const addStamp = async (
  userId: string,
  qrCodeId: string
): Promise<AddStampResponse> => {
  try {
    const response = await fetch("/api/stamps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, qrCodeId }),
    });

    const result: AddStampResponse = await response.json();
    return result;
  } catch (error) {
    console.error("❌ スタンプ登録リクエストエラー:", error);
    return {
      success: false,
      message: "ネットワークエラーが発生しました",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * スタンプ日時を日本語フォーマット
 * @param dateString ISO形式の日時文字列
 * @returns 日本語フォーマット（例: "2026年2月8日 14:30"）
 */
export const formatStampDate = (dateString: string): string => {
  if (!dateString) return "未登録";

  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");

    return `${year}年${month}月${day}日 ${hours}:${minutes}`;
  } catch (error) {
    console.error("❌ 日付フォーマットエラー:", error);
    return "日付エラー";
  }
};

/**
 * スタンプ進捗を計算
 * @param currentCount 現在のスタンプ数
 * @param goalCount 目標スタンプ数
 * @returns 進捗情報（percentage, remaining, isComplete）
 */
export const getStampProgress = (
  currentCount: number,
  goalCount: number
): StampProgress => {
  const percentage = Math.min(100, (currentCount / goalCount) * 100);
  const remaining = Math.max(0, goalCount - currentCount);
  const isComplete = currentCount >= goalCount;

  return {
    percentage,
    remaining,
    isComplete,
  };
};
