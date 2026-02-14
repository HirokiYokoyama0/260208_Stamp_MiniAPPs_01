import { UserMemo, UpdateUserMemoRequest } from "@/types/memo";

/**
 * ユーザーの次回メモを取得
 */
export const fetchUserMemo = async (
  userId: string
): Promise<UserMemo | null> => {
  try {
    const response = await fetch(`/api/users/${userId}/memo`);
    const data = await response.json();

    if (!data.success) {
      console.error("❌ 次回メモ取得エラー:", data.error);
      return null;
    }

    return data.memo;
  } catch (error) {
    console.error("❌ 次回メモ取得エラー:", error);
    return null;
  }
};

/**
 * ユーザーの次回メモを更新
 */
export const updateUserMemo = async (
  userId: string,
  next_visit_date: string | null,
  next_memo: string | null
): Promise<{
  success: boolean;
  message: string;
  memo?: UserMemo;
}> => {
  try {
    const response = await fetch(`/api/users/${userId}/memo`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        next_visit_date,
        next_memo,
      } as Omit<UpdateUserMemoRequest, "userId">),
    });

    const data = await response.json();
    return {
      success: data.success,
      message: data.message,
      memo: data.memo,
    };
  } catch (error) {
    console.error("❌ 次回メモ更新エラー:", error);
    return {
      success: false,
      message: "エラーが発生しました",
    };
  }
};

/**
 * 日付を「YYYY年M月D日」形式にフォーマット
 *
 * タイムゾーン問題を回避するため、YYYY-MM-DD形式の文字列を直接分解します
 * new Date("2026-04-13") はタイムゾーンによって前日になる可能性があるため使用しません
 */
export const formatVisitDate = (dateString: string | null): string | null => {
  if (!dateString) return null;

  try {
    // YYYY-MM-DD形式の文字列を直接分解（タイムゾーン問題を回避）
    const [year, month, day] = dateString.split('-').map(Number);

    // バリデーション
    if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
      console.error("❌ 日付フォーマットエラー: 不正な日付形式", dateString);
      return null;
    }

    return `${year}年${month}月${day}日`;
  } catch (error) {
    console.error("❌ 日付フォーマットエラー:", error);
    return null;
  }
};
