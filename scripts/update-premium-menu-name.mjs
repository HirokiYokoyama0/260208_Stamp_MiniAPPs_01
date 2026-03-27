import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log('🔧 プレミアムメニュー特典の名前と説明を変更します\n');
console.log('===========================================\n');

// 現在のデータを確認
console.log('📊 変更前のデータ:');
const { data: before, error: beforeError } = await supabase
  .from('milestone_rewards')
  .select('*')
  .eq('reward_type', 'premium_menu')
  .single();

if (beforeError) {
  console.error('❌ エラー:', beforeError.message);
  process.exit(1);
}

console.log('  名前:', before.name);
console.log('  説明:', before.description);
console.log('');

// データを更新
console.log('✏️  データを更新中...');
const { data: updated, error: updateError } = await supabase
  .from('milestone_rewards')
  .update({
    name: '選べるメニュー割引',
    description: '小顔エステ10%OFF or ホワイトニング10%OFF or 自費10%OFFクーポン'
  })
  .eq('reward_type', 'premium_menu')
  .select()
  .single();

if (updateError) {
  console.error('❌ 更新エラー:', updateError.message);
  process.exit(1);
}

console.log('✅ 更新完了！\n');
console.log('📊 変更後のデータ:');
console.log('  名前:', updated.name);
console.log('  説明:', updated.description);
console.log('\n===========================================\n');
