import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface CreateFamilyRequest {
  userId: string; // LINEユーザーID（親となるユーザー）
  familyName: string; // 家族名
}

/**
 * POST /api/families/create
 * 新しい家族グループを作成し、リクエストユーザーを親（代表者）として登録
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: CreateFamilyRequest = await request.json();
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
          message: "家族名を入力してください",
          error: "Empty family name",
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

    // 新しい家族グループを作成
    const { data: newFamily, error: familyError } = await supabase
      .from("families")
      .insert({
        family_name: familyName.trim(),
        representative_user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (familyError || !newFamily) {
      console.error("家族作成エラー:", familyError);
      return NextResponse.json(
        {
          success: false,
          message: "家族の作成に失敗しました",
          error: familyError?.message || "Unknown error",
        },
        { status: 500 }
      );
    }

    // プロフィールを更新（親として登録）
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        family_id: newFamily.id,
        family_role: "parent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("プロフィール更新エラー:", updateError);
      // 家族作成は成功したが、プロフィール更新に失敗した場合
      // ロールバックは実装していないので、警告ログを出力
      console.warn(`⚠️  家族は作成されましたが、プロフィール更新に失敗: Family ${newFamily.id}`);
      return NextResponse.json(
        {
          success: false,
          message: "家族の作成に失敗しました",
          error: updateError.message,
        },
        { status: 500 }
      );
    }

    console.log(
      `✅ 家族作成成功: User ${userId} created Family ${newFamily.id} (${newFamily.family_name})`
    );

    return NextResponse.json(
      {
        success: true,
        message: `家族「${newFamily.family_name}」を作成しました`,
        family: {
          id: newFamily.id,
          family_name: newFamily.family_name,
          representative_user_id: newFamily.representative_user_id,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("家族作成API エラー:", error);
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
