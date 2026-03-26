import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

(async () => {
  console.log('=========================================');
  console.log('📊 stamp_history の実際の stamp_method 値を確認');
  console.log('=========================================\n');

  // stamp_methodの値ごとにカウント
  const { data: methodCounts, error } = await supabase
    .from('stamp_history')
    .select('stamp_method')
    .limit(1000);

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  // stamp_methodの値を集計
  const counts: Record<string, number> = {};
  methodCounts?.forEach((record) => {
    const method = record.stamp_method;
    counts[method] = (counts[method] || 0) + 1;
  });

  console.log('📋 stamp_method の値と件数:\n');
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([method, count]) => {
      console.log(`  "${method}": ${count}件`);
    });

  console.log('\n=========================================');
  console.log('📋 QR関連のレコードを詳しく確認（最新5件）');
  console.log('=========================================\n');

  const { data: qrRecords } = await supabase
    .from('stamp_history')
    .select('stamp_method, amount, notes, visit_date')
    .or('stamp_method.eq.qr,stamp_method.eq.qr_scan')
    .order('visit_date', { ascending: false })
    .limit(5);

  if (qrRecords && qrRecords.length > 0) {
    console.table(qrRecords);
  } else {
    console.log('  QR関連のレコードが見つかりません');
  }
})();
