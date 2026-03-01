import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * スロットゲームによるスタンプ付与API
 *
 * エンドポイント: POST /api/stamps/slot
 *
 * ゲーム結果に応じたスタンプ数をユーザーに付与する。
 * 重複チェックなし（何回でもプレイ可能）
 */

interface SlotStampRequest {
  userId: string; // LINEユーザーID（必須）
  stamps: number; // 付与スタンプ個数: 1（はずれ） / 5（あたり） / 8（だいあたり）
}

interface SlotStampResponse {
  success: boolean;
  message: string;
  stampCount?: number;   // 付与後の合計スタンプ数
  stampsAdded?: number;  // 今回付与したスタンプ個数
  error?: string;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<SlotStampResponse>> {
  try {
    const body: SlotStampRequest = await request.json();
    const { userId, stamps } = body;

    // バリデーション
    if (!userId || stamps === undefined) {
      return NextResponse.json(
        {
          success: false,
          message: "必須パラメータが不足しています",
          error: "Missing required fields: userId, stamps",
        },
        { status: 400 }
      );
    }

    if (!Number.isInteger(stamps) || stamps < 1) {
      return NextResponse.json(
        {
          success: false,
          message: "無効なスタンプ個数です",
          error: `Invalid stamps: ${stamps}. Must be a positive integer`,
        },
        { status: 400 }
      );
    }

    // ユーザー存在チェック
    const { data: profileData, error: fetchError } = await supabase
      .from("profiles")
      .select("id, stamp_count")
      .eq("id", userId)
      .single();

    if (fetchError || !profileData) {
      return NextResponse.json(
        {
          success: false,
          message: "ユーザーが見つかりません",
          error: fetchError?.message || "User not found",
        },
        { status: 404 }
      );
    }

    const currentStampCount = profileData.stamp_count ?? 0;
    const nextStampNumber = currentStampCount + stamps;

    // stamp_historyに新規レコードを挿入
    const { error: insertError } = await supabase
      .from("stamp_history")
      .insert({
        user_id: userId,
        visit_date: new Date().toISOString(),
        stamp_number: nextStampNumber,
        stamp_method: "slot_game",
        amount: stamps,
        notes: `スロットゲーム: ${stamps}個付与`,
      });

    if (insertError) {
      console.error("スロットスタンプ登録エラー:", insertError);
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
    const { data: updatedProfile } = await supabase
      .from("profiles")
      .select("stamp_count")
      .eq("id", userId)
      .single();

    const finalStampCount = updatedProfile?.stamp_count ?? nextStampNumber;

    console.log(
      `✅ スロットスタンプ登録成功: User ${userId}, +${stamps}個, 合計: ${finalStampCount}個`
    );

    return NextResponse.json(
      {
        success: true,
        message: `${stamps}個のスタンプを獲得しました！`,
        stampCount: finalStampCount,
        stampsAdded: stamps,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("スロットスタンプAPI エラー:", error);
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
