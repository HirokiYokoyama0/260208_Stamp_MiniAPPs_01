import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// .env.local を読み込み
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ 環境変数が設定されていません');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '設定済み' : '未設定');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '設定済み' : '未設定');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 profiles テーブルの real_name カラムを確認中...\n');

try {
  // 1. real_name カラムが存在するかテスト
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, real_name, ticket_number')
    .limit(5);

  if (error) {
    console.log('❌ エラーが発生しました:', error.message);
    if (error.message.includes('column') && error.message.includes('does not exist')) {
      console.log('\n⚠️  real_name カラムがまだ作成されていない可能性があります');
      console.log('   マイグレーション 012_add_real_name_column.sql を実行してください');
    }
    process.exit(1);
  }

  console.log('✅ real_name カラムが正常に存在します！\n');
  console.log('📊 最初の5件のデータ:');
  console.log('─'.repeat(80));

  if (data && data.length > 0) {
    data.forEach((profile, index) => {
      console.log(`${index + 1}. ID: ${profile.id}`);
      console.log(`   表示名: ${profile.display_name || '(なし)'}`);
      console.log(`   本名: ${profile.real_name || '(未設定)'}`);
      console.log(`   診察券番号: ${profile.ticket_number || '(未登録)'}`);
      console.log('─'.repeat(80));
    });
  } else {
    console.log('(データが存在しません)');
  }

  // 2. 統計情報を表示
  const { data: stats } = await supabase
    .from('profiles')
    .select('real_name', { count: 'exact', head: false });

  if (stats) {
    const totalCount = stats.length;
    const withRealName = stats.filter(p => p.real_name).length;
    const withoutRealName = totalCount - withRealName;

    console.log('\n📈 統計情報:');
    console.log(`   全ユーザー数: ${totalCount}`);
    console.log(`   本名登録済み: ${withRealName} (${totalCount > 0 ? Math.round(withRealName / totalCount * 100) : 0}%)`);
    console.log(`   本名未登録: ${withoutRealName} (${totalCount > 0 ? Math.round(withoutRealName / totalCount * 100) : 0}%)`);
  }

  console.log('\n✅ マイグレーションが正常に適用されています！');

} catch (err) {
  console.log('❌ 予期しないエラーが発生しました:', err.message);
  process.exit(1);
}
