import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { AddStampResponse } from "@/types/stamp";

interface ManualStampRequest {
  userId: string; // LINEユーザーID
  staffPin: string; // スタッフ暗証番号
}

/**
 * POST /api/stamps/manual
 * スタッフ手動スタンプ付与エンドポイント
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<AddStampResponse>> {
  try {
    const body: ManualStampRequest = await request.json();
    const { userId, staffPin } = body;

    // バリデーション
    if (!userId || !staffPin) {
      return NextResponse.json(
        {
          success: false,
          message: "ユーザーIDまたは暗証番号が不足しています",
          error: "Missing required fields",
        },
        { status: 400 }
      );
    }

    // 暗証番号の検証
    const correctPin = process.env.NEXT_PUBLIC_STAFF_PIN || "1234";
    if (staffPin !== correctPin) {
      console.error("❌ 暗証番号エラー: 入力値が一致しません");
      return NextResponse.json(
        {
          success: false,
          message: "暗証番号が間違っています",
          error: "Invalid PIN",
        },
        { status: 401 }
      );
    }

    // 重複チェック: 同日の登録済みチェック（QRスキャンも含む）
    const today = new Date().toISOString().split("T")[0];
    const { data: existing, error: checkError } = await supabase
      .from("stamp_history")
      .select("id")
      .eq("user_id", userId)
      .gte("visit_date", `${today}T00:00:00`)
      .lt("visit_date", `${today}T23:59:59`)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("重複チェックエラー:", checkError);
      return NextResponse.json(
        {
          success: false,
          message: "重複チェックに失敗しました",
          error: checkError.message,
        },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: "本日すでにスタンプを取得済みです",
          error: "Duplicate stamp",
        },
        { status: 400 }
      );
    }

    // 現在のスタンプ数を取得
    const { data: profileData, error: fetchError } = await supabase
      .from("profiles")
      .select("stamp_count")
      .eq("id", userId)
      .single();

    if (fetchError) {
      console.error("ユーザープロフィール取得エラー:", fetchError);
      return NextResponse.json(
        {
          success: false,
          message: "ユーザー情報の取得に失敗しました",
          error: fetchError.message,
        },
        { status: 404 }
      );
    }

    const currentStampCount = profileData?.stamp_count ?? 0;
    const nextStampNumber = currentStampCount + 1;

    // 手動付与用のQRコードID生成（MANUAL-YYYYMMDD-HHMMSS形式）
    const now = new Date();
    const manualQrCodeId = `MANUAL-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;

    // stamp_historyに新規レコードを挿入
    const { data: stampData, error: insertError } = await supabase
      .from("stamp_history")
      .insert({
        user_id: userId,
        visit_date: now.toISOString(),
        stamp_number: nextStampNumber,
        stamp_method: "manual_admin",
        qr_code_id: manualQrCodeId,
        notes: "スタッフ手動付与",
      })
      .select()
      .single();

    if (insertError) {
      console.error("スタンプ登録エラー:", insertError);
      return NextResponse.json(
        {
          success: false,
          message: "スタンプの登録に失敗しました",
          error: insertError.message,
        },
        { status: 500 }
      );
    }

    // トリガーでprofilesが自動更新されるため、更新後のstamp_countを取得
    const { data: updatedProfile, error: updatedFetchError } = await supabase
      .from("profiles")
      .select("stamp_count")
      .eq("id", userId)
      .single();

    const finalStampCount = updatedProfile?.stamp_count ?? nextStampNumber;

    console.log(
      `✅ スタッフ手動スタンプ登録成功: User ${userId}, Stamp #${nextStampNumber}, Total: ${finalStampCount}`
    );

    return NextResponse.json(
      {
        success: true,
        message: "スタンプを手動で付与しました",
        stampCount: finalStampCount,
        stampNumber: nextStampNumber,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("手動スタンプ登録API エラー:", error);
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
