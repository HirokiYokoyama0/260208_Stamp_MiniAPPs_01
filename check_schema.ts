import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

(async () => {
  console.log('=========================================');
  console.log('📊 stamp_history テーブルの制約を確認');
  console.log('=========================================\n');

  // PostgreSQLのCHECK制約を確認
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'stamp_history'::regclass
      AND contype = 'c';
    `
  });

  if (error) {
    console.log('RPC関数が存在しないため、別の方法で確認します\n');
    
    // stamp_methodの型定義を確認するため、エラーを起こしてみる
    const { error: insertError } = await supabase
      .from('stamp_history')
      .insert({
        user_id: 'test',
        stamp_method: 'invalid_method_test',
        amount: 1,
        stamp_number: 1,
        visit_date: new Date().toISOString()
      });
    
    if (insertError) {
      console.log('❌ INSERT エラーメッセージ:');
      console.log(insertError.message);
      console.log('\n制約情報:', insertError.details);
    }
  } else {
    console.table(data);
  }
})();
