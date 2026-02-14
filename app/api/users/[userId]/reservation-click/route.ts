// ============================================
// つくばホワイト歯科 LINEミニアプリ
// 予約ボタンクリック数カウントAPI
// ============================================
// 作成日: 2026-02-14
// エンドポイント: POST /api/users/[userId]/reservation-click
// 機能: 予約ボタンのクリック数を+1する
// ============================================

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabaseクライアントの初期化
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/users/[userId]/reservation-click
 *
 * 予約ボタンのクリック数を+1する
 *
 * @param request - Requestオブジェクト
 * @param params - Promise<{ userId: string }> (Next.js 16)
 * @returns JSON { success: boolean, message: string, clicks?: number }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Next.js 16: params is a Promise
    const { userId } = await params;

    // userIdの検証
    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "ユーザーIDが不正です",
        },
        { status: 400 }
      );
    }

    // データベース関数を呼び出してクリック数を+1
    const { data, error } = await supabase.rpc("increment_reservation_clicks", {
      p_user_id: userId,
    });

    // エラーハンドリング
    if (error) {
      console.error("❌ クリックカウントエラー:", error);
      return NextResponse.json(
        {
          success: false,
          message: "クリック数の更新に失敗しました",
          error: error.message,
        },
        { status: 500 }
      );
    }

    // ユーザーが存在しない場合（data = 0）
    if (data === 0) {
      console.warn("⚠️ ユーザーが見つかりません:", userId);
      return NextResponse.json(
        {
          success: false,
          message: "ユーザーが見つかりません",
        },
        { status: 404 }
      );
    }

    // 成功レスポンス
    console.log(`✅ クリック数更新成功: userId=${userId}, clicks=${data}`);
    return NextResponse.json({
      success: true,
      message: "クリック数を更新しました",
      clicks: data,
    });
  } catch (error) {
    // 予期しないエラー
    console.error("❌ 予期しないエラー:", error);
    return NextResponse.json(
      {
        success: false,
        message: "予期しないエラーが発生しました",
        error: String(error),
      },
      { status: 500 }
    );
  }
}
