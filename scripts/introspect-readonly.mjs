// ⚠️ READ-ONLY introspection. SELECT / HEAD count only. No INSERT/UPDATE/DELETE/DDL.
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// コード/ドキュメント/マイグレーションに登場する全テーブル候補
const tables = [
  'profiles', 'stamp_history', 'rewards', 'reward_exchanges', 'milestone_rewards',
  'event_logs', 'families', 'family_members', 'family_stamp_totals',
  'staff', 'activity_logs', 'surveys', 'survey_questions', 'survey_responses',
  'dental_records', 'message_delivery_logs', 'event_logs_daily_summary',
];
// ドキュメント記載のビュー
const views = ['daily_active_users', 'event_summary'];

console.log('🔎 Supabase 実在テーブル/ビュー 読み取り専用チェック\n' + '='.repeat(70));

for (const t of [...tables, ...views]) {
  // HEADカウント（行は取得しない）
  const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
  if (error) {
    console.log(`❌ ${t.padEnd(28)} : 存在しない or アクセス不可 (${error.code || ''} ${error.message})`);
    continue;
  }
  // カラム把握のため1行だけ取得（存在する場合）
  const { data: sample } = await supabase.from(t).select('*').limit(1);
  const cols = sample && sample.length > 0 ? Object.keys(sample[0]) : [];
  console.log(`✅ ${t.padEnd(28)} : ${String(count).padStart(7)} 行  | columns(${cols.length}): ${cols.join(', ') || '(空テーブルのためカラム不明)'}`);
}

console.log('\n✅ 完了（読み取りのみ・変更なし）');
