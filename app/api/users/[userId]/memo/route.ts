import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  GetUserMemoResponse,
  UpdateUserMemoRequest,
  UpdateUserMemoResponse,
  UserMemo,
} from "@/types/memo";

/**
 * GET /api/users/[userId]/memo
 * ユーザーの次回メモを取得
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
): Promise<NextResponse<GetUserMemoResponse>> {
  try {
    const { userId } = await context.params;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          memo: null,
          error: "User ID is required",
        },
        { status: 400 }
      );
    }

    // profilesテーブルから次回メモ情報を取得
    const { data, error } = await supabase
      .from("profiles")
      .select("next_visit_date, next_memo, next_memo_updated_at")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("❌ 次回メモ取得エラー:", error);
      return NextResponse.json(
        {
          success: false,
          memo: null,
          error: error.message,
        },
        { status: 404 }
      );
    }

    const memo: UserMemo = {
      next_visit_date: data?.next_visit_date || null,
      next_memo: data?.next_memo || null,
      next_memo_updated_at: data?.next_memo_updated_at || null,
    };

    return NextResponse.json(
      {
        success: true,
        memo,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ 次回メモ取得API エラー:", error);
    return NextResponse.json(
      {
        success: false,
        memo: null,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users/[userId]/memo
 * ユーザーの次回メモを更新
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
): Promise<NextResponse<UpdateUserMemoResponse>> {
  try {
    const { userId } = await context.params;
    const body: Omit<UpdateUserMemoRequest, "userId"> = await request.json();
    const { next_visit_date, next_memo } = body;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message: "User ID is required",
          error: "Missing userId",
        },
        { status: 400 }
      );
    }

    // バリデーション: next_visit_date が指定されている場合は日付形式チェック
    if (
      next_visit_date !== null &&
      next_visit_date !== undefined &&
      next_visit_date !== ""
    ) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(next_visit_date)) {
        return NextResponse.json(
          {
            success: false,
            message: "日付はYYYY-MM-DD形式で指定してください",
            error: "Invalid date format",
          },
          { status: 400 }
        );
      }
    }

    // バリデーション: next_memo が指定されている場合は文字数チェック（最大200文字）
    if (
      next_memo !== null &&
      next_memo !== undefined &&
      next_memo !== "" &&
      next_memo.length > 200
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "メッセージは200文字以内で入力してください",
          error: "Message too long",
        },
        { status: 400 }
      );
    }

    // profilesテーブルを更新
    const updateData: Record<string, any> = {
      next_memo_updated_at: new Date().toISOString(),
    };

    // next_visit_date が指定されている場合は更新
    if (next_visit_date !== undefined) {
      updateData.next_visit_date =
        next_visit_date === null || next_visit_date === ""
          ? null
          : next_visit_date;
    }

    // next_memo が指定されている場合は更新
    if (next_memo !== undefined) {
      updateData.next_memo = next_memo === "" ? null : next_memo;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", userId)
      .select("next_visit_date, next_memo, next_memo_updated_at")
      .single();

    if (error) {
      console.error("❌ 次回メモ更新エラー:", error);
      return NextResponse.json(
        {
          success: false,
          message: "次回メモの更新に失敗しました",
          error: error.message,
        },
        { status: 500 }
      );
    }

    const memo: UserMemo = {
      next_visit_date: data?.next_visit_date || null,
      next_memo: data?.next_memo || null,
      next_memo_updated_at: data?.next_memo_updated_at || null,
    };

    console.log("✅ 次回メモを更新しました:", { userId, memo });

    return NextResponse.json(
      {
        success: true,
        message: "次回メモを更新しました",
        memo,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ 次回メモ更新API エラー:", error);
    return NextResponse.json(
      {
        success: false,
        message: "サーバーエラーが発生しました",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
