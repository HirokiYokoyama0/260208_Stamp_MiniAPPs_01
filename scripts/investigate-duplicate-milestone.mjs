import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function investigate() {
  const testUserId = 'U5c70cd61f4fe89a65381cd7becee8de3';

  console.log('🔍 10スタンプで2つのマイルストーン特典が発行された問題の調査\n');

  // 1. スタンプ履歴を時系列で確認
  console.log('📋 1. スタンプ履歴（時系列）');
  const { data: stampHistory } = await supabase
    .from('stamp_history')
    .select('*')
    .eq('user_id', testUserId)
    .order('visit_date', { ascending: true });

  if (stampHistory) {
    console.table(stampHistory.map(s => ({
      visit_date: s.visit_date,
      stamp_number: s.stamp_number,
      amount: s.amount,
      stamp_method: s.stamp_method,
      notes: s.notes?.substring(0, 30)
    })));
  }

  // 2. マイルストーン履歴を確認
  console.log('\n📋 2. マイルストーン履歴');
  const { data: milestoneHistory } = await supabase
    .from('milestone_history')
    .select('*')
    .eq('user_id', testUserId)
    .order('reached_at', { ascending: true });

  if (milestoneHistory) {
    console.table(milestoneHistory.map(m => ({
      milestone: m.milestone,
      reached_at: m.reached_at,
      reward_exchange_id: m.reward_exchange_id
    })));
  }

  // 3. 特典交換履歴を確認
  console.log('\n📋 3. 特典交換履歴（マイルストーン特典のみ）');
  const { data: rewardExchanges } = await supabase
    .from('reward_exchanges')
    .select('*, milestone_rewards(reward_type, name)')
    .eq('user_id', testUserId)
    .eq('is_milestone_based', true)
    .order('exchanged_at', { ascending: true });

  if (rewardExchanges) {
    console.table(rewardExchanges.map(r => ({
      id: r.id,
      exchanged_at: r.exchanged_at,
      milestone_reached: r.milestone_reached,
      status: r.status,
      reward_type: r.milestone_rewards?.reward_type,
      reward_name: r.milestone_rewards?.name,
      notes: r.notes?.substring(0, 40)
    })));
  }

  // 4. 現在のプロフィール状態
  console.log('\n📋 4. 現在のプロフィール状態');
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, stamp_count, family_id')
    .eq('id', testUserId)
    .single();

  console.log({
    display_name: profile?.display_name,
    stamp_count: profile?.stamp_count,
    family_id: profile?.family_id
  });

  // 5. 家族情報を確認
  if (profile?.family_id) {
    console.log('\n📋 5. 家族情報');
    const { data: familyTotal } = await supabase
      .from('family_stamp_totals')
      .select('*')
      .eq('family_id', profile.family_id)
      .single();

    console.log({
      family_name: familyTotal?.family_name,
      total_stamp_count: familyTotal?.total_stamp_count,
      member_count: familyTotal?.member_count
    });

    // 家族メンバーのスタンプ数
    const { data: members } = await supabase
      .from('profiles')
      .select('id, display_name, stamp_count, family_role')
      .eq('family_id', profile.family_id);

    console.log('\n📋 6. 家族メンバーのスタンプ数');
    console.table(members);
  }

  // 7. 問題分析
  console.log('\n🔍 問題分析:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 10スタンプのマイルストーン特典を抽出
  const milestone10Rewards = rewardExchanges?.filter(r => r.milestone_reached === 10);

  if (milestone10Rewards && milestone10Rewards.length > 1) {
    console.log(`❌ 問題確認: 10スタンプで${milestone10Rewards.length}つのマイルストーン特典が発行されています`);
    console.log('\n詳細:');
    milestone10Rewards.forEach((r, i) => {
      console.log(`\n[特典${i + 1}]`);
      console.log(`  ID: ${r.id}`);
      console.log(`  発行日時: ${r.exchanged_at}`);
      console.log(`  ステータス: ${r.status}`);
      console.log(`  特典タイプ: ${r.milestone_rewards?.reward_type}`);
      console.log(`  特典名: ${r.milestone_rewards?.name}`);
      console.log(`  メモ: ${r.notes}`);
    });

    // スタンプ履歴から10スタンプ到達のタイミングを確認
    const stamp10Record = stampHistory?.find(s => s.stamp_number === 10);
    if (stamp10Record) {
      console.log(`\n📌 10スタンプ到達の履歴:`);
      console.log(`  日時: ${stamp10Record.visit_date}`);
      console.log(`  スタンプ数: ${stamp10Record.stamp_number}`);
      console.log(`  付与数: ${stamp10Record.amount}`);
      console.log(`  方法: ${stamp10Record.stamp_method}`);
      console.log(`  メモ: ${stamp10Record.notes}`);
    }

    console.log('\n🤔 推測される原因:');
    console.log('  A. マイルストーン判定が2回実行された（重複実行）');
    console.log('  B. 個人スタンプ10個 + 家族合算スタンプ10個で2回判定された');
    console.log('  C. スタッフ操作で履歴削除後、再度10スタンプに到達した');
  } else {
    console.log('✅ 10スタンプのマイルストーン特典は1つのみです');
  }
}

investigate().catch(console.error);
