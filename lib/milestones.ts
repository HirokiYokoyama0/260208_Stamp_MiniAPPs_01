import { supabase } from "@/lib/supabase";
import { MilestoneReward } from "@/types/reward";

/**
 * 特典タイプ（優先度順）
 */
export enum RewardType {
  TOOTHBRUSH = 'toothbrush',    // 優先度: 1（最低）
  POIC = 'poic',                 // 優先度: 2
  PREMIUM_MENU = 'premium_menu'  // 優先度: 3（最高）
}

/**
 * 優先度定義
 */
const REWARD_PRIORITY: Record<RewardType, number> = {
  [RewardType.TOOTHBRUSH]: 1,
  [RewardType.POIC]: 2,
  [RewardType.PREMIUM_MENU]: 3
};

/**
 * マイルストーン到達結果
 */
export interface MilestoneResult {
  milestone: number;
  rewardType: RewardType;
}

/**
 * マイルストーンごとの特典タイプを判定（優先度ルール適用）
 *
 * ルール:
 * - 300以降150の倍数: PREMIUM_MENU（最優先）
 * - 50の倍数: POIC（次優先）
 * - 10の倍数: TOOTHBRUSH（最低優先）
 *
 * 優先度の高い特典のみ返す
 */
function getRewardTypeForMilestone(milestone: number): RewardType {
  // 300 + 150の倍数チェック（最優先）
  if (milestone === 300 || (milestone > 300 && (milestone - 300) % 150 === 0)) {
    return RewardType.PREMIUM_MENU;
  }

  // 50の倍数チェック（次優先）
  if (milestone % 50 === 0) {
    return RewardType.POIC;
  }

  // 10の倍数チェック（最低優先）
  if (milestone % 10 === 0) {
    return RewardType.TOOTHBRUSH;
  }

  throw new Error(`Invalid milestone: ${milestone}`);
}

/**
 * スタンプ数変更時にマイルストーンを判定
 *
 * @param oldStampCount 古いスタンプ数
 * @param newStampCount 新しいスタンプ数
 * @returns 到達したマイルストーンと付与する特典のリスト（優先度ルール適用済み）
 */
export function checkMilestones(
  oldStampCount: number,
  newStampCount: number
): MilestoneResult[] {
  const results: MilestoneResult[] = [];

  // 通過した全マイルストーンを取得
  const allMilestones: number[] = [];

  // 10の倍数を収集
  const old10 = Math.floor(oldStampCount / 10);
  const new10 = Math.floor(newStampCount / 10);
  for (let i = old10 + 1; i <= new10; i++) {
    allMilestones.push(i * 10);
  }

  // 重複を除去してソート
  const uniqueMilestones = [...new Set(allMilestones)].sort((a, b) => a - b);

  // 各マイルストーンに対して優先度の高い特典を選択
  for (const milestone of uniqueMilestones) {
    const rewardType = getRewardTypeForMilestone(milestone);
    results.push({ milestone, rewardType });
  }

  return results;
}

/**
 * 有効期限を計算
 *
 * @param validityMonths 有効期限（月数）: 0 = 当日限り, NULL = 無期限, n = nヶ月後
 * @returns 有効期限日時（ISO文字列） or null
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
 * 特典の自動付与
 *
 * @param userId ユーザーID
 * @param milestone 到達したマイルストーン
 * @param rewardType 特典タイプ
 * @returns 作成された reward_exchanges レコード
 */
export async function grantMilestoneReward(
  userId: string,
  milestone: number,
  rewardType: RewardType
) {
  // 特典タイプに応じてマスターデータを取得
  const { data: reward, error: rewardError } = await supabase
    .from('milestone_rewards')
    .select('*')
    .eq('reward_type', rewardType)
    .eq('is_active', true)
    .single();

  if (rewardError || !reward) {
    throw new Error(`Reward not found for type: ${rewardType}, error: ${rewardError?.message}`);
  }

  // 初回判定（POIC用）
  let isFirstTime = false;
  if (rewardType === RewardType.POIC) {
    const { data: existingPoic } = await supabase
      .from('reward_exchanges')
      .select('id')
      .eq('user_id', userId)
      .eq('reward_id', reward.id)
      .eq('is_milestone_based', true)
      .limit(1);

    isFirstTime = !existingPoic || existingPoic.length === 0;
  }

  // 有効期限計算
  const validUntil = calculateValidUntil(reward.validity_months);

  // 特典付与レコード作成
  const { data: exchange, error: exchangeError } = await supabase
    .from('reward_exchanges')
    .insert({
      user_id: userId,
      reward_id: reward.id,
      milestone_reached: milestone,
      status: 'pending',
      valid_until: validUntil,
      is_first_time: isFirstTime,
      is_milestone_based: true,
      stamp_count_used: milestone, // 参考値
      notes: `${milestone}スタンプ到達で自動付与`,
      exchanged_at: new Date().toISOString()
    })
    .select()
    .single();

  if (exchangeError) {
    throw new Error(`Failed to grant reward: ${exchangeError.message}`);
  }

  // マイルストーン履歴に記録
  const { error: historyError } = await supabase
    .from('milestone_history')
    .insert({
      user_id: userId,
      milestone: milestone,
      reward_exchange_id: exchange?.id,
      reached_at: new Date().toISOString()
    });

  if (historyError) {
    console.error(`⚠️ マイルストーン履歴の記録に失敗:`, historyError);
    // エラーでも特典付与は成功しているのでthrowしない
  }

  return exchange;
}

/**
 * 特典の説明文を取得（初回/2回目判定込み）
 *
 * @param reward マイルストーン特典
 * @param userRewardHistory ユーザーの特典交換履歴
 * @returns 説明文
 */
export function getRewardDescription(
  reward: MilestoneReward,
  userRewardHistory: Array<{ reward_id: string; status: string; is_milestone_based?: boolean }>
): string {
  if (reward.reward_type === RewardType.POIC && reward.is_first_time_special) {
    // POICで初回特別対応がある場合
    const hasReceivedPoic = userRewardHistory.some(
      h => h.reward_id === reward.id && h.is_milestone_based === true
    );

    return hasReceivedPoic
      ? (reward.subsequent_description || reward.description || '')
      : (reward.first_time_description || reward.description || '');
  }

  return reward.description || '';
}

/**
 * マイルストーンタイプの説明文を取得
 *
 * @param milestoneType マイルストーンタイプ
 * @returns 説明文
 */
export function getMilestoneDescription(milestoneType: string): string {
  switch (milestoneType) {
    case 'every_10':
      return '10スタンプごとに獲得';
    case 'every_50':
      return '50スタンプごとに獲得';
    case 'every_150_from_300':
      return '300スタンプ到達、以降150スタンプごと';
    default:
      return '';
  }
}
