import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface CheckSurveyRequest {
  userId: string; // profiles.id (LIFF profile.userId)
}

interface CheckSurveyResponse {
  shouldShow: boolean;
  surveyId?: string;
  surveyTitle?: string;
  surveyDescription?: string;
  shownCount?: number;
  postponedCount?: number;
}

/**
 * POST /api/survey/check
 * ユーザーが回答すべき未回答アンケートがあるかチェック
 *
 * 実装仕様:
 * - survey_targets から未回答のアンケートを取得
 * - is_active = true のアンケートのみ対象
 * - last_shown_at から24時間以上経過していれば再表示
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<CheckSurveyResponse>> {
  try {
    const body: CheckSurveyRequest = await request.json();
    const { userId } = body;

    // バリデーション
    if (!userId) {
      return NextResponse.json(
        {
          shouldShow: false,
        },
        { status: 400 }
      );
    }

    // 未回答のアンケートターゲットを取得
    const { data: targets, error: targetsError } = await supabase
      .from("survey_targets")
      .select(`
        survey_id,
        shown_count,
        postponed_count,
        last_shown_at,
        surveys:survey_id (
          id,
          title,
          description,
          is_active
        )
      `)
      .eq("user_id", userId)
      .is("answered_at", null); // 未回答のみ

    if (targetsError) {
      console.error("survey_targets取得エラー:", targetsError);
      return NextResponse.json(
        {
          shouldShow: false,
        },
        { status: 500 }
      );
    }

    // アンケートが存在しない、または全て回答済み
    if (!targets || targets.length === 0) {
      return NextResponse.json({
        shouldShow: false,
      });
    }

    // is_active = true のアンケートのみフィルタ
    const activeTargets = targets.filter(
      (target: any) => {
        const survey = Array.isArray(target.surveys)
          ? target.surveys[0]
          : target.surveys;
        return survey?.is_active === true;
      }
    );

    if (activeTargets.length === 0) {
      return NextResponse.json({
        shouldShow: false,
      });
    }

    // 最初のアンケートを取得
    const target = activeTargets[0];
    const survey = Array.isArray(target.surveys)
      ? target.surveys[0]
      : target.surveys;

    // 表示ロジック: last_shown_at から24時間以上経過していれば再表示
    const now = new Date();
    const lastShown = target.last_shown_at
      ? new Date(target.last_shown_at)
      : null;

    // 24時間以内に表示済みなら非表示
    if (
      lastShown &&
      now.getTime() - lastShown.getTime() < 24 * 60 * 60 * 1000
    ) {
      return NextResponse.json({
        shouldShow: false,
      });
    }

    // 表示すべきアンケートが存在
    return NextResponse.json({
      shouldShow: true,
      surveyId: target.survey_id,
      surveyTitle: survey?.title,
      surveyDescription: survey?.description,
      shownCount: target.shown_count,
      postponedCount: target.postponed_count,
    });
  } catch (error) {
    console.error("アンケートチェックAPI エラー:", error);
    return NextResponse.json(
      {
        shouldShow: false,
      },
      { status: 500 }
    );
  }
}
