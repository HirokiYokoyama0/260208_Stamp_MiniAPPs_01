import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { AddStampResponse } from "@/types/stamp";

interface StampRegistrationRequest {
  userId: string; // LINEユーザーID
  qrCodeId: string; // QRコードから読み取った値
}

/**
 * POST /api/stamps
 * スタンプ登録エンドポイント
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<AddStampResponse>> {
  try {
    const body: StampRegistrationRequest = await request.json();
    const { userId, qrCodeId } = body;

    // バリデーション
    if (!userId || !qrCodeId) {
      return NextResponse.json(
        {
          success: false,
          message: "ユーザーIDまたはQRコードIDが不足しています",
          error: "Missing required fields",
        },
        { status: 400 }
      );
    }

    // QRコードIDの基本チェック（空文字列のみ）
    if (qrCodeId.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "QRコードの値が無効です",
          error: "Invalid QR code",
        },
        { status: 400 }
      );
    }

    // 重複チェック: 同日同QRの登録済みチェック
    const today = new Date().toISOString().split("T")[0];
    const { data: existing, error: checkError } = await supabase
      .from("stamp_history")
      .select("id")
      .eq("user_id", userId)
      .eq("qr_code_id", qrCodeId)
      .gte("visit_date", `${today}T00:00:00`)
      .lt("visit_date", `${today}T23:59:59`)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 = "not found" は正常（重複なし）
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

    // 現在のスタンプ数を取得（次のstamp_numberを決定するため）
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

    // stamp_historyに新規レコードを挿入
    const { data: stampData, error: insertError } = await supabase
      .from("stamp_history")
      .insert({
        user_id: userId,
        visit_date: new Date().toISOString(),
        stamp_number: nextStampNumber,
        stamp_method: "qr_scan",
        qr_code_id: qrCodeId,
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
      `✅ スタンプ登録成功: User ${userId}, Stamp #${nextStampNumber}, Total: ${finalStampCount}`
    );

    return NextResponse.json(
      {
        success: true,
        message: "スタンプを登録しました",
        stampCount: finalStampCount,
        stampNumber: nextStampNumber,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("スタンプ登録API エラー:", error);
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
