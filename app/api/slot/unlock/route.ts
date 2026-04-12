import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * スロットゲーム解放API
 *
 * エンドポイント: POST /api/slot/unlock
 *
 * 院内QRコード読み取り後、指定ユーザーのスロットゲームを解放する。
 * スタンプは付与しない。event_logsに記録する（stamp_historyは使わない）。
 */

interface SlotUnlockRequest {
  userId: string; // 解放対象の子供のユーザーID
}

interface SlotUnlockResponse {
  success: boolean;
  message: string;
  alreadyUnlocked?: boolean;
  error?: string;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<SlotUnlockResponse>> {
  try {
    const body: SlotUnlockRequest = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message: "ユーザーIDが必要です",
          error: "Missing required field: userId",
        },
        { status: 400 }
      );
    }

    // ユーザー存在チェック
    const { data: profileData, error: fetchError } = await supabase
      .from("profiles")
      .select("id")
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

    // 今日すでに解放済みか確認（JST基準）
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);
    const todayStart = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());
    const todayStartUTC = new Date(todayStart.getTime() - jstOffset).toISOString();

    const { data: existingUnlock } = await supabase
      .from("event_logs")
      .select("id")
      .eq("user_id", userId)
      .eq("event_name", "slot_unlock")
      .gte("created_at", todayStartUTC)
      .limit(1);

    if (existingUnlock && existingUnlock.length > 0) {
      return NextResponse.json(
        {
          success: true,
          message: "もう かいほうずみ だよ！",
          alreadyUnlocked: true,
        },
        { status: 200 }
      );
    }

    // event_logsに解放イベントを記録
    const { error: insertError } = await supabase
      .from("event_logs")
      .insert({
        user_id: userId,
        event_name: "slot_unlock",
        source: "qr_scan",
        metadata: {
          unlock_type: "qr_scan",
          unlock_date: jstNow.toISOString().slice(0, 10),
          timestamp: now.toISOString(),
        },
      });

    if (insertError) {
      console.error("スロット解放記録エラー:", insertError);
      return NextResponse.json(
        {
          success: false,
          message: "かいほうに しっぱいしました",
          error: insertError.message,
        },
        { status: 500 }
      );
    }

    console.log(`✅ スロット解放: User ${userId}`);

    return NextResponse.json(
      {
        success: true,
        message: "スロットゲーム かいほう！",
        alreadyUnlocked: false,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("スロット解放API エラー:", error);
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
