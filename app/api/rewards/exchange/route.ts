import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { calculateStampDisplay } from "@/lib/stamps";
import {
  ExchangeRewardRequest,
  ExchangeRewardResponse,
  RewardExchange,
} from "@/types/reward";

/**
 * マイルストーンタイプから最小スタンプ数を取得
 */
function getMinimumStampsForMilestone(milestoneType: string): number {
  switch (milestoneType) {
    case 'every_10':
      return 10;
    case 'every_50':
      return 50;
    case 'every_150_from_300':
      return 300;
    default:
      return 10;
  }
}

/**
 * 有効期限を計算
 */
function calculateValidUntil(validityMonths: number | null): string | null {
  if (validityMonths === null || validityMonths === undefined) {
    return null; // 無期限
  }

  const now = new Date();

  if (validityMonths === 0) {
    // 当日限り（その日の23:59:59まで）
    now.setHours(23, 59, 59, 999);
    return now.toISOString();
  }

  // n ヶ月後
  now.setMonth(now.getMonth() + validityMonths);
  return now.toISOString();
}

/**
 * POST /api/rewards/exchange
 * 特典を交換（積み上げ式 - スタンプは減らない）
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ExchangeRewardResponse>> {
  try {
    const body: ExchangeRewardRequest = await request.json();
    const { userId, rewardId, milestone } = body;

    console.log('🔍 交換リクエスト:', { userId, rewardId, milestone });

    // バリデーション
    if (!userId || !rewardId) {
      console.log('❌ バリデーションエラー: userId または rewardId が不足');
      return NextResponse.json(
        {
          success: false,
          message: "ユーザーIDまたは特典IDが不足しています",
          error: "Missing required fields",
        },
        { status: 400 }
      );
    }

    // 1. 特典情報を取得（マイルストーン型特典）
    console.log('📊 milestone_rewards から特典を取得中... rewardId:', rewardId);
    const { data: reward, error: rewardError } = await supabase
      .from("milestone_rewards")
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

    // 3. スタンプ数の確認（マイルストーン型は常に交換可能）
    // マイルストーン型特典は到達済みマイルストーンなので、
    // フロントエンドで制御済み。ここでは最小限のチェックのみ
    const { fullStamps } = calculateStampDisplay(currentStampCount);

    // 最小スタンプ数のチェック
    const minStamps = getMinimumStampsForMilestone(reward.milestone_type);
    if (fullStamps < minStamps) {
      return NextResponse.json(
        {
          success: false,
          message: `スタンプが不足しています（現在${fullStamps}個）`,
          error: "Insufficient stamps",
        },
        { status: 400 }
      );
    }

    // 4. pending チェック（重複防止）
    // マイルストーン型の場合、同じ特典でもマイルストーンが違えば別の申請
    console.log('🔍 既存のpending申請をチェック中...');
    const { data: existingPending } = await supabase
      .from("reward_exchanges")
      .select("id, milestone_reached")
      .eq("user_id", userId)
      .eq("reward_id", rewardId)
      .eq("milestone_reached", milestone || fullStamps) // マイルストーン一致もチェック
      .eq("status", "pending")
      .maybeSingle();

    console.log('既存のpending:', existingPending);
    console.log('今回のmilestone:', milestone);

    if (existingPending) {
      console.log('❌ 既にpending申請が存在します (同じマイルストーン)');
      return NextResponse.json(
        {
          success: false,
          message: "この特典は申請中です。受付でお受け取りください。",
          error: "Already pending",
        },
        { status: 400 }
      );
    }

    // 5. 【重要】積み上げ式: スタンプは絶対に減らさない！
    // profiles.stamp_count の更新は一切行わない

    // 6. 初回判定（POIC用）
    let isFirstTime = false;
    if (reward.reward_type === 'poic') {
      const { data: existingPoic } = await supabase
        .from('reward_exchanges')
        .select('id')
        .eq('user_id', userId)
        .eq('reward_id', rewardId)
        .eq('is_milestone_based', true)
        .limit(1);

      isFirstTime = !existingPoic || existingPoic.length === 0;
    }

    // 7. 有効期限計算
    const validUntil = calculateValidUntil(reward.validity_months);

    // 8. 交換履歴を記録（pending）
    const insertData = {
      user_id: userId,
      reward_id: rewardId,
      stamp_count_used: milestone || fullStamps,
      milestone_reached: milestone || fullStamps,
      status: "pending" as const,
      valid_until: validUntil,
      is_first_time: isFirstTime,
      is_milestone_based: true,
      notes: `特典交換: ${reward.name} (${milestone || fullStamps}スタンプ到達)`,
    };
    console.log('💾 交換履歴を記録中:', insertData);

    const { data: exchange, error: exchangeError } = await supabase
      .from("reward_exchanges")
      .insert(insertData)
      .select()
      .single();

    if (exchangeError) {
      console.error("❌ 交換履歴登録エラー:", exchangeError);
      return NextResponse.json(
        {
          success: false,
          message: "交換履歴の登録に失敗しました",
          error: exchangeError.message,
        },
        { status: 500 }
      );
    }

    console.log(
      `✅ 特典交換申請: User ${userId}, Reward ${reward.name}, スタンプ ${currentStampCount}個（積み上げ式 - 減らさない）`
    );

    return NextResponse.json(
      {
        success: true,
        message: `${reward.name}の交換を申請しました。受付でお受け取りください。`,
        exchange: exchange as RewardExchange,
        newStampCount: currentStampCount, // 積み上げ式 - スタンプは絶対に減らない
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
