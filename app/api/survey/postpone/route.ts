import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface PostponeSurveyRequest {
  userId: string; // profiles.id (LIFF profile.userId)
  surveyId: string;
}

interface PostponeSurveyResponse {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * POST /api/survey/postpone
 * アンケート「あとで回答する」ボタン押下時の処理
 *
 * 実装仕様:
 * - RPC関数 increment_survey_postponed を呼び出し
 * - postponed_count, last_postponed_at を更新
 * - shown_count, last_shown_at も更新（表示したことになるため）
 * - 24時間以内は再表示されない
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<PostponeSurveyResponse>> {
  try {
    const body: PostponeSurveyRequest = await request.json();
    const { userId, surveyId } = body;

    // バリデーション
    if (!userId || !surveyId) {
      return NextResponse.json(
        {
          success: false,
          message: "ユーザーIDまたはアンケートIDが不足しています",
          error: "Missing required fields",
        },
        { status: 400 }
      );
    }

    // RPC関数を呼び出し
    const { error: rpcError } = await supabase.rpc(
      "increment_survey_postponed",
      {
        p_user_id: userId,
        p_survey_id: surveyId,
      }
    );

    if (rpcError) {
      console.error("increment_survey_postponed エラー:", rpcError);
      return NextResponse.json(
        {
          success: false,
          message: "後回し処理に失敗しました",
          error: rpcError.message,
        },
        { status: 500 }
      );
    }

    console.log(
      `✅ アンケート後回し: User ${userId}, Survey ${surveyId}`
    );

    return NextResponse.json(
      {
        success: true,
        message: "後で回答するに設定しました",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("アンケート後回しAPI エラー:", error);
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
