import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface JoinFamilyRequest {
  userId: string; // LINEユーザーID
  inviteCode: string; // 家族ID（招待コード）
}

/**
 * POST /api/families/join
 * 子どもが招待コードで家族に参加
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: JoinFamilyRequest = await request.json();
    const { userId, inviteCode } = body;

    // バリデーション
    if (!userId || !inviteCode) {
      return NextResponse.json(
        {
          success: false,
          message: "ユーザーIDまたは招待コードが指定されていません",
          error: "Missing required fields",
        },
        { status: 400 }
      );
    }

    // 招待コードから家族を検索
    const { data: family, error: familyError } = await supabase
      .from("families")
      .select("*")
      .eq("id", inviteCode)
      .single();

    if (familyError || !family) {
      console.error("家族検索エラー:", familyError);
      return NextResponse.json(
        {
          success: false,
          message: "招待コードが無効です",
          error: "Invalid invite code",
        },
        { status: 400 }
      );
    }

    // ユーザーの現在の状態を確認（二重参加防止）
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, family_id, display_name")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("プロフィール取得エラー:", profileError);
      return NextResponse.json(
        {
          success: false,
          message: "ユーザー情報の取得に失敗しました",
          error: "User not found",
        },
        { status: 404 }
      );
    }

    // すでに家族に参加している場合はエラー
    if (profile.family_id !== null) {
      console.warn(`⚠️  すでに家族に参加済み: User ${userId}, Family ${profile.family_id}`);
      return NextResponse.json(
        {
          success: false,
          message: "すでに他の家族に参加しています",
          error: "Already in a family",
        },
        { status: 400 }
      );
    }

    // プロフィールを更新
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        family_id: family.id,
        family_role: "child",
      })
      .eq("id", userId);

    if (updateError) {
      console.error("プロフィール更新エラー:", updateError);
      return NextResponse.json(
        {
          success: false,
          message: "家族への参加に失敗しました",
          error: updateError.message,
        },
        { status: 500 }
      );
    }

    console.log(
      `✅ 家族参加成功: User ${userId} joined Family ${family.id} (${family.family_name})`
    );

    return NextResponse.json(
      {
        success: true,
        message: `${family.family_name}に参加しました`,
        family: {
          id: family.id,
          family_name: family.family_name,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("家族参加API エラー:", error);
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
