import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

(async () => {
  console.log('=========================================');
  console.log('📊 notes フィールドの location 値を確認');
  console.log('=========================================\n');

  const { data: allRecords } = await supabase
    .from('stamp_history')
    .select('stamp_method, notes, amount')
    .or('stamp_method.eq.qr,stamp_method.eq.qr_scan')
    .order('created_at', { ascending: false })
    .limit(50);

  if (allRecords) {
    console.log('📋 全QRレコードのnotes:\n');
    const notesCounts: Record<string, number> = {};
    
    allRecords.forEach((record) => {
      const notes = record.notes || '(null)';
      notesCounts[notes] = (notesCounts[notes] || 0) + 1;
    });

    Object.entries(notesCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([notes, count]) => {
        console.log(`  "${notes}": ${count}件`);
      });

    console.log('\n📋 詳細（最新10件）:\n');
    console.table(allRecords.slice(0, 10));
  }
})();
