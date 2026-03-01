import { supabase } from "./supabase";
import {
  StampHistoryRecord,
  AddStampResponse,
  StampProgress,
} from "@/types/stamp";

/**
 * ユーザーのスタンプ数を取得（profilesテーブルから）
 * @param userId LINEユーザーID
 * @returns スタンプ数
 */
export const fetchStampCount = async (userId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("stamp_count")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("❌ スタンプ数の取得に失敗しました:", error);
      return 0;
    }

    return data?.stamp_count ?? 0;
  } catch (err) {
    console.error("❌ 予期しないエラー:", err);
    return 0;
  }
};

/**
 * ユーザーの訪問回数を取得（profilesテーブルから）
 * @param userId LINEユーザーID
 * @returns 訪問回数
 */
export const fetchVisitCount = async (userId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("visit_count")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("❌ 訪問回数の取得に失敗しました:", error);
      return 0;
    }

    return data?.visit_count ?? 0;
  } catch (err) {
    console.error("❌ 予期しないエラー:", err);
    return 0;
  }
};

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

// ========================================
// スタンプ表示ユーティリティ
// ========================================

/**
 * スタンプ表示データ
 */
export interface StampDisplay {
  /** スタンプ数（stamp_countをそのまま表示） */
  fullStamps: number;
  /** 次のスタンプまでの進捗（常に0%、将来拡張用） */
  progress: number;
  /** スタンプ数（生データ） */
  totalPoints: number;
}

/**
 * スタンプ数を表示データに変換
 * DBの値をそのまま返す（変換しない）
 *
 * @param stampCount - スタンプ数（10, 20, 30, 135...）
 * @returns スタンプ表示データ
 *
 * @example
 * calculateStampDisplay(135)
 * // → { fullStamps: 135, progress: 0, totalPoints: 135 }
 *
 * calculateStampDisplay(20)
 * // → { fullStamps: 20, progress: 0, totalPoints: 20 }
 */
export function calculateStampDisplay(stampCount: number): StampDisplay {
  return {
    fullStamps: stampCount,
    progress: 0,
    totalPoints: stampCount,
  };
}

/**
 * スタンプ数を文字列に変換（「○個」形式）
 *
 * @param stampCount - スタンプ数
 * @returns フォーマットされた文字列
 *
 * @example
 * formatStampCount(135) // → "135個"
 * formatStampCount(20)  // → "20個"
 */
export function formatStampCount(stampCount: number): string {
  return `${stampCount}個`;
}

/**
 * スタンプ付与量の定数
 */
export const STAMP_AMOUNTS = {
  /** 通常の来院: 10個 */
  REGULAR_VISIT: 10,
  /** スロット当選（最小）: 3個 */
  SLOT_MIN: 3,
  /** スロット当選（中）: 5個 */
  SLOT_MID: 5,
  /** スロット当選（最大）: 8個 */
  SLOT_MAX: 8,
  /** アンケート報酬: 30個 */
  SURVEY_REWARD: 30,
} as const;

// ========================================
// スタンプ履歴表示ユーティリティ
// ========================================

/**
 * スタンプ取得方法のラベルを取得
 * @param stampMethod スタンプ取得方法
 * @returns 日本語ラベル
 */
export const getStampMethodLabel = (
  stampMethod: StampHistoryRecord["stamp_method"]
): string => {
  switch (stampMethod) {
    case "qr_scan":
      return "来院（QRコード）";
    case "manual_admin":
      return "スタッフ操作";
    case "import":
      return "データ移行";
    case "survey_reward":
      return "アンケート回答報酬";
    case "slot_game":
      return "スロットゲーム";
    default:
      return "不明";
  }
};

/**
 * スタンプ取得方法に応じたアイコン名を取得（lucide-react）
 * @param stampMethod スタンプ取得方法
 * @returns アイコン名
 */
export const getStampMethodIcon = (
  stampMethod: StampHistoryRecord["stamp_method"]
): "QrCode" | "User" | "Package" | "FileText" => {
  switch (stampMethod) {
    case "qr_scan":
      return "QrCode";
    case "manual_admin":
      return "User";
    case "import":
      return "Package";
    case "survey_reward":
      return "FileText";
    default:
      return "QrCode";
  }
};
