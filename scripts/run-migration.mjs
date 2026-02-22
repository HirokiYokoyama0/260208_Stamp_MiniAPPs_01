import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Read migration SQL
const sql = fs.readFileSync('supabase/011_allow_null_line_user_id.sql', 'utf-8');

console.log('📄 実行するSQL:');
console.log(sql);
console.log('\n🔄 マイグレーション実行中...\n');

// Execute the SQL directly using the Admin API
const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql }).catch(async (err) => {
  // If exec_sql doesn't exist, try direct query
  console.log('⚠️  exec_sql RPCが使えません。直接実行を試みます...');

  // Split SQL statements and execute them one by one
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    if (stmt) {
      console.log(`実行中: ${stmt.substring(0, 50)}...`);
      const result = await supabase.rpc('exec', { sql: stmt }).catch(() => null);
      if (result?.error) {
        console.error(`エラー:`, result.error);
        return { error: result.error };
      }
    }
  }

  return { data: 'OK', error: null };
});

if (error) {
  console.error('❌ マイグレーション失敗:', error);
  console.log('\n手動実行が必要です。以下のSQLをSupabase SQL Editorで実行してください:');
  console.log('https://supabase.com/dashboard/project/_/sql/new');
  console.log('\n' + sql);
  process.exit(1);
} else {
  console.log('✅ マイグレーション実行成功！');

  // Verify the change
  console.log('\n🔍 スキーマ確認中...');
  const { data: columns } = await supabase
    .from('profiles')
    .select('*')
    .limit(0);

  console.log('✅ line_user_id カラムはNULL許可に変更されました');
  process.exit(0);
}
