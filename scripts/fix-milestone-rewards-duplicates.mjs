import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log('🔧 milestone_rewards の重複データを修正します\n');

// 1. 現在のデータを確認
const { data: before, error: beforeError } = await supabase
  .from('milestone_rewards')
  .select('id, name, reward_type, display_order')
  .order('display_order');

if (beforeError) {
  console.log('❌ エラー:', beforeError.message);
  process.exit(1);
}

console.log('📊 修正前のデータ:');
before.forEach((r, i) => {
  console.log(`  ${i + 1}. ${r.name} (${r.reward_type}) - ID: ${r.id.substring(0, 8)}...`);
});
console.log('');

// 2. 各reward_typeごとに最初の1件のみを残し、残りを削除
const types = ['toothbrush', 'poic', 'premium_menu'];
const idsToKeep = [];

for (const type of types) {
  const { data: records } = await supabase
    .from('milestone_rewards')
    .select('id')
    .eq('reward_type', type)
    .order('created_at', { ascending: true })
    .limit(1);

  if (records && records.length > 0) {
    idsToKeep.push(records[0].id);
  }
}

console.log('✅ 保持するレコードのID:');
idsToKeep.forEach(id => console.log(`  - ${id.substring(0, 8)}...`));
console.log('');

// 3. 保持するID以外を削除
const idsToDelete = before
  .filter(r => !idsToKeep.includes(r.id))
  .map(r => r.id);

if (idsToDelete.length > 0) {
  console.log(`🗑️  削除するレコード数: ${idsToDelete.length}`);

  for (const id of idsToDelete) {
    const { error: deleteError } = await supabase
      .from('milestone_rewards')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.log(`  ❌ 削除失敗 (ID: ${id.substring(0, 8)}...):`, deleteError.message);
    } else {
      console.log(`  ✅ 削除成功 (ID: ${id.substring(0, 8)}...)`);
    }
  }
}

// 4. 修正後のデータを確認
const { data: after, error: afterError } = await supabase
  .from('milestone_rewards')
  .select('*')
  .order('display_order');

if (afterError) {
  console.log('\n❌ 確認エラー:', afterError.message);
  process.exit(1);
}

console.log('\n📊 修正後のデータ:');
after.forEach((r, i) => {
  console.log(`  ${i + 1}. ${r.name} (${r.reward_type})`);
  console.log(`     milestone_type: ${r.milestone_type}`);
  console.log(`     validity_months: ${r.validity_months}`);
});

console.log('\n✅ 修正完了！');
