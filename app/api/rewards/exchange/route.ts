import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  ExchangeRewardRequest,
  ExchangeRewardResponse,
  RewardExchange,
} from "@/types/reward";

/**
 * POST /api/rewards/exchange
 * 特典を交換（積み上げ式 - スタンプは減らない）
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ExchangeRewardResponse>> {
  try {
    const body: ExchangeRewardRequest = await request.json();
    const { userId, rewardId } = body;

    // バリデーション
    if (!userId || !rewardId) {
      return NextResponse.json(
        {
          success: false,
          message: "ユーザーIDまたは特典IDが不足しています",
          error: "Missing required fields",
        },
        { status: 400 }
      );
    }

    // 1. 特典情報を取得
    const { data: reward, error: rewardError } = await supabase
      .from("rewards")
      .select("*")
      .eq("id", rewardId)
      .eq("is_active", true)
      .single();

    if (rewardError || !reward) {
      console.error("❌ 特典取得エラー:", rewardError);
      return NextResponse.json(
        {
          success: false,
          message: "特典が見つかりません",
          error: rewardError?.message || "Reward not found",
        },
        { status: 404 }
      );
    }

    // 2. ユーザーの現在のスタンプ数を取得
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stamp_count")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("❌ ユーザー情報取得エラー:", profileError);
      return NextResponse.json(
        {
          success: false,
          message: "ユーザー情報の取得に失敗しました",
          error: profileError?.message || "User not found",
        },
        { status: 404 }
      );
    }

    const currentStampCount = profile.stamp_count ?? 0;

    // 3. スタンプ数の確認
    if (currentStampCount < reward.required_stamps) {
      return NextResponse.json(
        {
          success: false,
          message: `スタンプが不足しています（現在${currentStampCount}個、必要${reward.required_stamps}個）`,
          error: "Insufficient stamps",
        },
        { status: 400 }
      );
    }

    // 4. 積み上げ式: スタンプは減らさない（条件を満たせば何度でも交換可能）
    // profiles.stamp_count はそのまま維持

    // 5. 交換履歴を記録
    const { data: exchange, error: exchangeError } = await supabase
      .from("reward_exchanges")
      .insert({
        user_id: userId,
        reward_id: rewardId,
        stamp_count_used: reward.required_stamps,
        status: "pending",
        notes: `特典交換: ${reward.name}`,
      })
      .select()
      .single();

    if (exchangeError) {
      console.error("❌ 交換履歴登録エラー:", exchangeError);
      // エラーだがスタンプは既に減っているので、エラーログだけ出力
      // ロールバック処理は後で実装可能
    }

    console.log(
      `✅ 特典交換成功: User ${userId}, Reward ${reward.name}, スタンプ ${currentStampCount}個（積み上げ式）`
    );

    return NextResponse.json(
      {
        success: true,
        message: `${reward.name}と交換しました！`,
        exchange: exchange as RewardExchange,
        newStampCount: currentStampCount, // 積み上げ式なのでスタンプは減らない
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ 特典交換API エラー:", error);
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
