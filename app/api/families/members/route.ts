import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface RemoveMemberRequest {
  userId: string; // 操作するユーザー（親）のID
  memberId: string; // 削除対象のメンバーID
}

/**
 * DELETE /api/families/members
 * 家族からメンバーを削除（親専用）
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const body: RemoveMemberRequest = await request.json();
    const { userId, memberId } = body;

    // バリデーション
    if (!userId || !memberId) {
      return NextResponse.json(
        {
          success: false,
          message: "ユーザーIDまたはメンバーIDが指定されていません",
          error: "Missing required fields",
        },
        { status: 400 }
      );
    }

    // 自分（削除する人）の情報を取得
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
          message: "メンバーの削除は保護者のみ可能です",
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

    // 削除対象のメンバー情報を取得
    const { data: targetMember, error: memberError } = await supabase
      .from("profiles")
      .select("id, display_name, family_id, family_role")
      .eq("id", memberId)
      .single();

    if (memberError) {
      console.error("メンバー取得エラー:", memberError);
      return NextResponse.json(
        {
          success: false,
          message: "削除対象のメンバーが見つかりません",
          error: memberError.message,
        },
        { status: 404 }
      );
    }

    // 同じ家族のメンバーか確認
    if (targetMember.family_id !== profile.family_id) {
      return NextResponse.json(
        {
          success: false,
          message: "このメンバーは同じ家族に所属していません",
          error: "Not in same family",
        },
        { status: 400 }
      );
    }

    // 親（代表者）を削除しようとした場合はエラー
    if (targetMember.family_role === "parent") {
      return NextResponse.json(
        {
          success: false,
          message: "代表者（親）は削除できません",
          error: "Cannot remove parent",
        },
        { status: 400 }
      );
    }

    // メンバーを家族から削除（family_id を NULL にする）
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ family_id: null })
      .eq("id", memberId);

    if (updateError) {
      console.error("メンバー削除エラー:", updateError);
      return NextResponse.json(
        {
          success: false,
          message: "メンバーの削除に失敗しました",
          error: updateError.message,
        },
        { status: 500 }
      );
    }

    console.log(
      `✅ メンバー削除成功: ${targetMember.display_name} (${memberId}) removed from Family ${profile.family_id}`
    );

    return NextResponse.json(
      {
        success: true,
        message: `${targetMember.display_name}を家族から削除しました`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("メンバー削除API エラー:", error);
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
