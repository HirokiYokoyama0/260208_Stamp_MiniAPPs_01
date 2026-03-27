import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log('🗑️  reward_exchanges の50スタンプの交換履歴を削除\n');
console.log('===========================================\n');

const userId = 'U5c70cd61f4fe89a65381cd7becee8de3';

// milestone_reached = 50 のレコードを削除
const { data, error } = await supabase
  .from('reward_exchanges')
  .delete()
  .eq('user_id', userId)
  .eq('milestone_reached', 50)
  .select();

if (error) {
  console.error('❌ 削除エラー:', error.message);
} else {
  console.log(`✅ 削除完了: ${data?.length || 0} 件`);
  if (data && data.length > 0) {
    data.forEach(ex => {
      console.log(`   - ID: ${ex.id.substring(0, 8)}..., milestone_reached: ${ex.milestone_reached}`);
    });
  }
}

console.log('\n===========================================\n');
