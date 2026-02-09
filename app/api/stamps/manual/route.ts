import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { AddStampResponse } from "@/types/stamp";

interface ManualStampRequest {
  userId: string; // LINEユーザーID
  staffPin: string; // スタッフ暗証番号
  newStampCount: number; // 新しいスタンプ数
}

/**
 * POST /api/stamps/manual
 * スタッフ手動スタンプ数変更エンドポイント
 *
 * 機能:
 * - スタッフがユーザーのスタンプ数を任意の値に変更できる
 * - 1日1回制限なし（何度でも変更可能）
 * - 監査証跡としてstamp_historyに記録
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<AddStampResponse>> {
  try {
    const body: ManualStampRequest = await request.json();
    const { userId, staffPin, newStampCount } = body;

    // バリデーション
    if (!userId || !staffPin || newStampCount === undefined) {
      return NextResponse.json(
        {
          success: false,
          message: "必要なパラメータが不足しています",
          error: "Missing required fields",
        },
        { status: 400 }
      );
    }

    // スタンプ数のバリデーション
    if (newStampCount < 0 || newStampCount > 999) {
      return NextResponse.json(
        {
          success: false,
          message: "スタンプ数は0～999の範囲で指定してください",
          error: "Invalid stamp count",
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

    // スタンプ数が変更されていない場合
    if (currentStampCount === newStampCount) {
      return NextResponse.json(
        {
          success: true,
          message: "スタンプ数は既に同じ値です",
          stampCount: currentStampCount,
        },
        { status: 200 }
      );
    }

    // profilesテーブルのstamp_countを直接更新
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        stamp_count: newStampCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("スタンプ数更新エラー:", updateError);
      return NextResponse.json(
        {
          success: false,
          message: "スタンプ数の更新に失敗しました",
          error: updateError.message,
        },
        { status: 500 }
      );
    }

    // 監査証跡を記録（stamp_historyに変更履歴を保存）
    const now = new Date();
    const manualQrCodeId = `MANUAL-ADJUST-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;

    const changeDescription =
      newStampCount > currentStampCount
        ? `スタッフ操作: +${newStampCount - currentStampCount}個 (${currentStampCount} → ${newStampCount})`
        : `スタッフ操作: ${newStampCount - currentStampCount}個 (${currentStampCount} → ${newStampCount})`;

    await supabase.from("stamp_history").insert({
      user_id: userId,
      visit_date: now.toISOString(),
      stamp_number: newStampCount,
      stamp_method: "manual_admin",
      qr_code_id: manualQrCodeId,
      notes: changeDescription,
    });

    console.log(
      `✅ スタッフによるスタンプ数変更成功: User ${userId}, ${currentStampCount} → ${newStampCount}`
    );

    return NextResponse.json(
      {
        success: true,
        message: "スタンプ数を更新しました",
        stampCount: newStampCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("手動スタンプ変更API エラー:", error);
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
