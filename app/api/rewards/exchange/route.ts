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

    // 4. pending チェック（重複防止） + 有効期限チェック
    // マイルストーン型の場合、同じ特典でもマイルストーンが違えば別の申請
    console.log('🔍 既存のpending申請をチェック中...');
    const { data: existingPending } = await supabase
      .from("reward_exchanges")
      .select("id, milestone_reached, valid_until, status")
      .eq("user_id", userId)
      .eq("reward_id", rewardId)
      .eq("milestone_reached", milestone || fullStamps) // マイルストーン一致もチェック
      .eq("status", "pending")
      .maybeSingle();

    console.log('既存のpending:', existingPending);
    console.log('今回のmilestone:', milestone);

    if (existingPending) {
      // 既存のpending申請がある場合、有効期限をチェック
      if (existingPending.valid_until) {
        const now = new Date();
        const validUntil = new Date(existingPending.valid_until);

        if (validUntil < now) {
          // 期限切れの場合、自動的にexpiredに更新
          console.log('⏰ 既存の申請が期限切れのため、expired に更新します');
          await supabase
            .from("reward_exchanges")
            .update({ status: "expired" })
            .eq("id", existingPending.id);

          // 期限切れ処理後、新規申請として続行
        } else {
          // まだ有効な場合は重複エラー
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
      } else {
        // 有効期限がない場合は重複エラー
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

    // 8. 交換履歴を記録
    // 【あるべき姿】既存の available を pending に更新（update-not-insert）。
    //   available が無い場合のみ新規INSERT（後方互換）。
    //   fail-open: 予期せぬエラー時も INSERT にフォールバックし、患者の交換は必ず成立させる。
    //   詳細: Doc_miniApps/128, 127 §3-4
    const targetMilestone = milestone || fullStamps;
    const nowIso = new Date().toISOString();
    const exchangeNotes = `特典交換: ${reward.name} (${targetMilestone}スタンプ到達)`;
    let exchange: RewardExchange | null = null;

    // 8-1. 既存 available をアトミックに pending へ更新（新規レコードを増やさない）
    try {
      const { data: updatedRows, error: updateError } = await supabase
        .from("reward_exchanges")
        .update({
          status: "pending",
          valid_until: validUntil,
          is_first_time: isFirstTime,
          notes: exchangeNotes,
          updated_at: nowIso,
        })
        .eq("user_id", userId)
        .eq("reward_id", rewardId)
        .eq("milestone_reached", targetMilestone)
        .eq("is_milestone_based", true)
        .eq("status", "available") // ← available のみ対象（同時実行でも二重にならない）
        .select();

      if (updateError) {
        console.error("⚠️ available→pending 更新エラー（INSERTにフォールバック）:", updateError);
      } else if (updatedRows && updatedRows.length > 0) {
        exchange = updatedRows[0] as RewardExchange;
        console.log(`✅ 既存availableをpendingに更新（重複作成なし）: ${updatedRows.length}件`);
      }
    } catch (e) {
      console.error("⚠️ available更新で例外（INSERTにフォールバック）:", e);
    }

    // 8-2. available が無かった場合のみ、従来どおり新規INSERT（後方互換・fail-open）
    if (!exchange) {
      const insertData = {
        user_id: userId,
        reward_id: rewardId,
        stamp_count_used: targetMilestone,
        milestone_reached: targetMilestone,
        status: "pending" as const,
        valid_until: validUntil,
        is_first_time: isFirstTime,
        is_milestone_based: true,
        notes: exchangeNotes,
      };
      console.log('💾 交換履歴を記録中(INSERT):', insertData);

      const { data: inserted, error: exchangeError } = await supabase
        .from("reward_exchanges")
        .insert(insertData)
        .select()
        .single();

      if (exchangeError) {
        // 将来 UNIQUE(user_id,reward_id,milestone_reached) 適用後の重複INSERT(23505)は
        // 「既に交換済み」として正常扱いにし、患者の交換を失敗させない
        if (exchangeError.code === "23505") {
          console.warn("ℹ️ UNIQUE違反(23505): 既存レコードを返す（交換済み扱い）");
          const { data: existing } = await supabase
            .from("reward_exchanges")
            .select("*")
            .eq("user_id", userId)
            .eq("reward_id", rewardId)
            .eq("milestone_reached", targetMilestone)
            .eq("is_milestone_based", true)
            .limit(1);
          exchange = existing && existing.length > 0 ? (existing[0] as RewardExchange) : null;
        }

        if (!exchange) {
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
      } else {
        exchange = inserted as RewardExchange;
      }
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
