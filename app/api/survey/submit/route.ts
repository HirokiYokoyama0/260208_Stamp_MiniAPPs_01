import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface SubmitSurveyRequest {
  userId: string; // profiles.id (LIFF profile.userId)
  surveyId: string;
  q1Rating: number; // 1-5
  q2Comment: string;
  q3Recommend: number; // 0-10
}

interface SubmitSurveyResponse {
  success: boolean;
  message: string;
  rewardStamps?: number; // 付与したスタンプ数（10倍整数）
  error?: string;
}

/**
 * POST /api/survey/submit
 * アンケート回答を保存し、スタンプ報酬を付与
 *
 * 実装仕様:
 * 1. survey_answers にINSERT（重複チェック: unique(user_id, survey_id)）
 * 2. stamp_history にINSERT（stamp_method: 'survey_reward'）
 * 3. survey_targets の answered_at を更新
 * 4. トリガーで profiles.stamp_count が自動更新される
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<SubmitSurveyResponse>> {
  try {
    const body: SubmitSurveyRequest = await request.json();
    const { userId, surveyId, q1Rating, q2Comment, q3Recommend } = body;

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

    if (
      q1Rating === undefined ||
      q1Rating < 1 ||
      q1Rating > 5 ||
      q3Recommend === undefined ||
      q3Recommend < 0 ||
      q3Recommend > 10
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "回答内容が不正です",
          error: "Invalid answer values",
        },
        { status: 400 }
      );
    }

    // アンケート情報を取得（報酬スタンプ数を確認）
    const { data: survey, error: surveyError } = await supabase
      .from("surveys")
      .select("id, title, reward_stamps, is_active")
      .eq("id", surveyId)
      .single();

    if (surveyError || !survey) {
      console.error("アンケート取得エラー:", surveyError);
      return NextResponse.json(
        {
          success: false,
          message: "アンケートが見つかりません",
          error: "Survey not found",
        },
        { status: 404 }
      );
    }

    if (!survey.is_active) {
      return NextResponse.json(
        {
          success: false,
          message: "このアンケートは現在受付していません",
          error: "Survey is not active",
        },
        { status: 400 }
      );
    }

    // 現在のスタンプ数を取得
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stamp_count")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("ユーザープロフィール取得エラー:", profileError);
      return NextResponse.json(
        {
          success: false,
          message: "ユーザー情報の取得に失敗しました",
          error: profileError?.message || "Profile not found",
        },
        { status: 404 }
      );
    }

    const currentStampCount = profile.stamp_count ?? 0;
    const rewardStamps = survey.reward_stamps; // 10倍整数（例: 3 = 0.3スタンプ）
    const nextStampNumber = currentStampCount + rewardStamps;

    // 1. survey_answers にINSERT
    const { error: answerError } = await supabase
      .from("survey_answers")
      .insert({
        user_id: userId,
        survey_id: surveyId,
        q1_rating: q1Rating,
        q2_comment: q2Comment,
        q3_recommend: q3Recommend,
      });

    if (answerError) {
      // 重複エラー（既に回答済み）
      if (answerError.code === "23505") {
        console.warn(`重複回答検出: User ${userId}, Survey ${surveyId}`);
        return NextResponse.json(
          {
            success: false,
            message: "既に回答済みです",
            error: "Already answered",
          },
          { status: 409 }
        );
      }

      console.error("回答保存エラー:", answerError);
      return NextResponse.json(
        {
          success: false,
          message: "回答の保存に失敗しました",
          error: answerError.message,
        },
        { status: 500 }
      );
    }

    // 2. stamp_history にINSERT（スタンプ報酬を付与）
    const { error: stampError } = await supabase
      .from("stamp_history")
      .insert({
        user_id: userId,
        visit_date: new Date().toISOString(),
        stamp_number: nextStampNumber,
        amount: rewardStamps,
        stamp_method: "survey_reward",
        notes: `アンケート回答: ${surveyId}`,
      });

    if (stampError) {
      console.error("スタンプ付与エラー:", stampError);
      // 回答は保存されたが、スタンプ付与に失敗
      // ※ トランザクション未実装のため、一貫性が崩れる可能性あり
      return NextResponse.json(
        {
          success: false,
          message: "スタンプの付与に失敗しました",
          error: stampError.message,
        },
        { status: 500 }
      );
    }

    // 3. survey_targets の answered_at を更新
    const { error: targetError } = await supabase
      .from("survey_targets")
      .update({ answered_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("survey_id", surveyId);

    if (targetError) {
      console.error("survey_targets更新エラー:", targetError);
      // エラーでも処理は続行（回答とスタンプは既に保存済み）
    }

    console.log(
      `✅ アンケート回答成功: User ${userId}, Survey ${surveyId}, Reward ${rewardStamps}スタンプ`
    );

    return NextResponse.json(
      {
        success: true,
        message: "回答を受け付けました",
        rewardStamps: rewardStamps,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("アンケート送信API エラー:", error);
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
