import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log('🔧 reward_exchanges.reward_id の外部キー制約を削除します\n');
console.log('===========================================\n');

// SQLファイルを読み込んで実行
const sql = `
-- 既存の外部キー制約を削除
ALTER TABLE reward_exchanges
DROP CONSTRAINT IF EXISTS reward_exchanges_reward_id_fkey;
`;

console.log('📝 実行するSQL:');
console.log(sql);
console.log('');

try {
  // Supabase CLIではなく、直接SQLを実行
  // 注意: RPC経由ではDDLが実行できないため、Supabase Dashboardで手動実行が必要

  console.log('⚠️  このSQLはSupabase Dashboardで手動実行が必要です:');
  console.log('');
  console.log('1. Supabase Dashboard を開く');
  console.log('2. SQL Editor に移動');
  console.log('3. 以下のSQLを貼り付けて実行:');
  console.log('');
  console.log('```sql');
  console.log('ALTER TABLE reward_exchanges');
  console.log('DROP CONSTRAINT IF EXISTS reward_exchanges_reward_id_fkey;');
  console.log('```');
  console.log('');
  console.log('📍 URL: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql');

} catch (error) {
  console.error('❌ エラー:', error);
}

console.log('\n===========================================\n');
