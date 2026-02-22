import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface UpdateFamilyRequest {
  userId: string; // LINEユーザーID
  familyName: string; // 新しい家族名
}

/**
 * PATCH /api/families/update
 * 家族名を変更（親専用）
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const body: UpdateFamilyRequest = await request.json();
    const { userId, familyName } = body;

    // バリデーション
    if (!userId || !familyName) {
      return NextResponse.json(
        {
          success: false,
          message: "ユーザーIDまたは家族名が指定されていません",
          error: "Missing required fields",
        },
        { status: 400 }
      );
    }

    if (familyName.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "家族名は空にできません",
          error: "Empty family name",
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

    // 権限チェック: 親のみ
    if (profile.family_role !== "parent") {
      return NextResponse.json(
        {
          success: false,
          message: "家族名の変更は保護者のみ可能です",
          error: "Unauthorized",
        },
        { status: 403 }
      );
    }

    if (!profile.family_id) {
      return NextResponse.json(
        {
          success: false,
          message: "家族に所属していません",
          error: "No family",
        },
        { status: 404 }
      );
    }

    // 家族名を更新
    const { error: updateError } = await supabase
      .from("families")
      .update({ family_name: familyName.trim() })
      .eq("id", profile.family_id);

    if (updateError) {
      console.error("家族名更新エラー:", updateError);
      return NextResponse.json(
        {
          success: false,
          message: "家族名の更新に失敗しました",
          error: updateError.message,
        },
        { status: 500 }
      );
    }

    console.log(`✅ 家族名更新成功: Family ${profile.family_id} → "${familyName}"`);

    return NextResponse.json(
      {
        success: true,
        message: "家族名を更新しました",
        familyName,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("家族名更新API エラー:", error);
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
