import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/families/me?userId=xxx
 * 自分の家族情報 + メンバー一覧を取得
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
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

    // 自分の家族情報を取得
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("family_id, family_role")
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

    if (!profile?.family_id) {
      return NextResponse.json(
        {
          success: false,
          message: "家族に所属していません",
          error: "No family",
        },
        { status: 404 }
      );
    }

    // 家族情報を取得
    const { data: family, error: familyError } = await supabase
      .from("families")
      .select("*")
      .eq("id", profile.family_id)
      .single();

    if (familyError) {
      console.error("家族情報取得エラー:", familyError);
      return NextResponse.json(
        {
          success: false,
          message: "家族情報の取得に失敗しました",
          error: familyError.message,
        },
        { status: 500 }
      );
    }

    // メンバー一覧を取得
    const { data: members, error: membersError } = await supabase
      .from("profiles")
      .select("id, display_name, family_role, stamp_count, visit_count, line_user_id, ticket_number")
      .eq("family_id", profile.family_id);

    if (membersError) {
      console.error("メンバー一覧取得エラー:", membersError);
      return NextResponse.json(
        {
          success: false,
          message: "メンバー情報の取得に失敗しました",
          error: membersError.message,
        },
        { status: 500 }
      );
    }

    // family_stamp_totals ビューから家族合計を取得
    const { data: familyTotal, error: totalError } = await supabase
      .from("family_stamp_totals")
      .select("*")
      .eq("family_id", profile.family_id)
      .single();

    if (totalError) {
      console.warn("家族合計取得エラー:", totalError);
      // エラーでも続行（合計情報がなくても問題ない）
    }

    return NextResponse.json(
      {
        success: true,
        family: {
          ...family,
          members,
          total_stamp_count: familyTotal?.total_stamp_count || 0,
          total_visit_count: familyTotal?.total_visit_count || 0,
          member_count: familyTotal?.member_count || members.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("家族情報取得API エラー:", error);
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
