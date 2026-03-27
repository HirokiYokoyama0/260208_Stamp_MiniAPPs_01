import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

console.log('🔍 データベーススキーマ全体を確認\n');
console.log('===========================================\n');

async function main() {
  // 1. rewards テーブル（旧仕様）
  console.log('📊 1. rewards テーブル（旧仕様 - 手動交換型）');
  console.log('-------------------------------------------');
  const { data: rewards, error: rewardsError } = await supabase
    .from('rewards')
    .select('*')
    .order('display_order');

  if (rewardsError) {
    console.log('❌ エラー:', rewardsError.message);
  } else {
    console.log(`✅ レコード数: ${rewards?.length || 0}`);
    if (rewards && rewards.length > 0) {
      console.log('\n特典一覧:');
      rewards.forEach(r => {
        console.log(`  ${r.display_order}. ${r.name} (required_stamps: ${r.required_stamps})`);
      });
    } else {
      console.log('  → データなし（使われていない可能性）');
    }
  }

  // 2. milestone_rewards テーブル（新仕様）
  console.log('\n📊 2. milestone_rewards テーブル（新仕様 - マイルストーン型）');
  console.log('-------------------------------------------');
  const { data: milestoneRewards, error: mrError } = await supabase
    .from('milestone_rewards')
    .select('*')
    .order('display_order');

  if (mrError) {
    console.log('❌ エラー:', mrError.message);
  } else {
    console.log(`✅ レコード数: ${milestoneRewards?.length || 0}`);
    if (milestoneRewards && milestoneRewards.length > 0) {
      console.log('\n特典一覧:');
      milestoneRewards.forEach(r => {
        console.log(`  ${r.display_order}. ${r.name}`);
        console.log(`     - milestone_type: ${r.milestone_type}`);
        console.log(`     - reward_type: ${r.reward_type}`);
      });
    }
  }

  // 3. reward_exchanges テーブル（交換履歴 - 新旧両対応）
  console.log('\n📊 3. reward_exchanges テーブル（交換履歴）');
  console.log('-------------------------------------------');
  const { data: exchanges, error: exError } = await supabase
    .from('reward_exchanges')
    .select('id, reward_id, user_id, status, is_milestone_based, milestone_reached')
    .order('exchanged_at', { ascending: false })
    .limit(10);

  if (exError) {
    console.log('❌ エラー:', exError.message);
  } else {
    console.log(`✅ 最新10件の交換履歴:`);
    if (exchanges && exchanges.length > 0) {
      exchanges.forEach(ex => {
        const type = ex.is_milestone_based ? 'マイルストーン型' : '旧仕様';
        console.log(`  - ${ex.id.substring(0, 8)}... [${type}] status: ${ex.status}`);
      });
    } else {
      console.log('  → データなし');
    }
  }

  // 4. テーブルの役割を整理
  console.log('\n===========================================');
  console.log('📋 テーブル構造の整理:');
  console.log('-------------------------------------------');
  console.log('\n【旧仕様】');
  console.log('  rewards テーブル → 手動交換型の特典マスター');
  console.log('  ├─ required_stamps: 交換に必要なスタンプ数（固定）');
  console.log('  └─ 例: 10個で歯ブラシ、50個でPOIC など');

  console.log('\n【新仕様】');
  console.log('  milestone_rewards テーブル → マイルストーン型の特典マスター');
  console.log('  ├─ milestone_type: 10の倍数、50の倍数、300+150ごと');
  console.log('  └─ 例: 10個目、20個目、30個目... で歯ブラシ');

  console.log('\n【共通】');
  console.log('  reward_exchanges テーブル → 交換履歴（新旧両対応）');
  console.log('  ├─ is_milestone_based で区別');
  console.log('  ├─ reward_id → rewards.id または milestone_rewards.id');
  console.log('  └─ milestone_reached → マイルストーン到達数（新仕様のみ）');

  console.log('\n===========================================');
  console.log('💡 推奨事項:');
  console.log('-------------------------------------------');

  if (rewards && rewards.length > 0) {
    console.log('⚠️  rewards テーブルにデータが残っています');
    console.log('   → 旧仕様を完全に廃止する場合は削除を検討');
  } else {
    console.log('✅ rewards テーブルは空です（新仕様のみ使用中）');
  }

  console.log('\n===========================================\n');
}

main();
