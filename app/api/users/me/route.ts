import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/users/me
 * 現在のユーザー情報 + 家族情報を取得
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // リクエストヘッダーまたはクエリパラメータからユーザーIDを取得
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message: "ユーザーIDが指定されていません",
          error: "Missing userId parameter",
        },
        { status: 400 }
      );
    }

    // プロフィール + 家族情報を取得
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        `
        *,
        families:family_id (
          id,
          family_name,
          representative_user_id,
          created_at,
          updated_at
        )
      `
      )
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("プロフィール取得エラー:", profileError);
      return NextResponse.json(
        {
          success: false,
          message: "ユーザー情報の取得に失敗しました",
          error: profileError.message,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        profile,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("ユーザー情報取得API エラー:", error);
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
