import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface SetupRoleRequest {
  userId: string; // LINEユーザーID
  role: "parent" | "child";
  ticketNumber?: string; // 診察券番号
  realName?: string; // 本名
}

/**
 * POST /api/users/setup-role
 * 初回登録時の役割設定（親 or 子）
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: SetupRoleRequest = await request.json();
    const { userId, role, ticketNumber, realName } = body;

    // バリデーション
    if (!userId || !role) {
      return NextResponse.json(
        {
          success: false,
          message: "ユーザーIDまたは役割が指定されていません",
          error: "Missing required fields",
        },
        { status: 400 }
      );
    }

    if (role !== "parent" && role !== "child") {
      return NextResponse.json(
        {
          success: false,
          message: "役割は 'parent' または 'child' である必要があります",
          error: "Invalid role",
        },
        { status: 400 }
      );
    }

    if (role === "parent") {
      // 親の場合: 新規家族を自動作成
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("display_name")
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

      // 家族を作成
      const familyName = `${profile.display_name || "ユーザー"}の家族`;
      const { data: newFamily, error: familyError } = await supabase
        .from("families")
        .insert({
          family_name: familyName,
          representative_user_id: userId,
        })
        .select()
        .single();

      if (familyError) {
        console.error("家族作成エラー:", familyError);
        return NextResponse.json(
          {
            success: false,
            message: "家族の作成に失敗しました",
            error: familyError.message,
          },
          { status: 500 }
        );
      }

      // プロフィールを更新（診察券番号・本名も含む）
      const updateData: any = {
        family_id: newFamily.id,
        family_role: "parent",
      };

      if (ticketNumber) {
        updateData.ticket_number = ticketNumber;
      }

      if (realName) {
        updateData.real_name = realName;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", userId);

      if (updateError) {
        console.error("プロフィール更新エラー:", updateError);
        return NextResponse.json(
          {
            success: false,
            message: "プロフィールの更新に失敗しました",
            error: updateError.message,
          },
          { status: 500 }
        );
      }

      console.log(`✅ 親として登録完了: User ${userId}, Family ${newFamily.id}`);

      return NextResponse.json(
        {
          success: true,
          message: "家族を作成しました",
          family: newFamily,
        },
        { status: 201 }
      );
    } else {
      // 子の場合: family_role だけ設定（診察券番号・本名も含む）
      const updateData: any = {
        family_role: "child",
      };

      if (ticketNumber) {
        updateData.ticket_number = ticketNumber;
      }

      if (realName) {
        updateData.real_name = realName;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", userId);

      if (updateError) {
        console.error("プロフィール更新エラー:", updateError);
        return NextResponse.json(
          {
            success: false,
            message: "プロフィールの更新に失敗しました",
            error: updateError.message,
          },
          { status: 500 }
        );
      }

      console.log(`✅ 子として登録完了: User ${userId}`);

      return NextResponse.json(
        {
          success: true,
          message: "役割を設定しました",
          needsJoin: true,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("役割設定API エラー:", error);
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
