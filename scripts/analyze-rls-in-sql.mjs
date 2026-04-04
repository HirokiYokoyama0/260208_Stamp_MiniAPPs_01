import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

console.log('🔍 SQLファイルのRLSポリシー分析\n');
console.log('===========================================\n');

const supabaseDir = './supabase';

// SQLファイル一覧を取得
const sqlFiles = readdirSync(supabaseDir)
  .filter(file => file.endsWith('.sql'))
  .sort();

console.log(`📁 検索対象: ${sqlFiles.length} 個のSQLファイル\n`);

// 各SQLファイルを解析
const rlsPolicies = [];
const insecurePolicies = [];

for (const file of sqlFiles) {
  const filePath = join(supabaseDir, file);
  const content = readFileSync(filePath, 'utf-8');

  // RLSポリシーを検索
  const policyRegex = /CREATE POLICY\s+"([^"]+)"\s+ON\s+(\w+)\s+FOR\s+(\w+)[\s\S]*?USING\s*\(([\s\S]*?)\)/gi;
  let match;

  while ((match = policyRegex.exec(content)) !== null) {
    const [fullMatch, policyName, tableName, operation, usingClause] = match;

    const policy = {
      file,
      policyName,
      tableName,
      operation,
      usingClause: usingClause.trim(),
      isInsecure: usingClause.trim() === 'true'
    };

    rlsPolicies.push(policy);

    if (policy.isInsecure) {
      insecurePolicies.push(policy);
    }
  }

  // RLS有効化の確認
  const rlsEnableRegex = /ALTER TABLE\s+(\w+)\s+ENABLE ROW LEVEL SECURITY/gi;
  let rlsMatch;

  while ((rlsMatch = rlsEnableRegex.exec(content)) !== null) {
    // RLS有効化の情報を記録（必要に応じて）
  }
}

// 結果表示
console.log('📊 RLSポリシー統計');
console.log('-------------------------------------------');
console.log(`  総ポリシー数: ${rlsPolicies.length}`);
console.log(`  🔴 危険なポリシー (USING true): ${insecurePolicies.length}`);
console.log(`  ✅ 安全なポリシー: ${rlsPolicies.length - insecurePolicies.length}`);
console.log('');

// テーブルごとの集計
const tableStats = {};
for (const policy of rlsPolicies) {
  if (!tableStats[policy.tableName]) {
    tableStats[policy.tableName] = {
      total: 0,
      insecure: 0,
      policies: []
    };
  }
  tableStats[policy.tableName].total++;
  if (policy.isInsecure) {
    tableStats[policy.tableName].insecure++;
  }
  tableStats[policy.tableName].policies.push(policy);
}

console.log('📋 テーブルごとのRLSポリシー');
console.log('-------------------------------------------');
for (const [tableName, stats] of Object.entries(tableStats)) {
  const status = stats.insecure > 0 ? '🔴' : '✅';
  console.log(`${status} ${tableName}`);
  console.log(`   ポリシー数: ${stats.total}, 危険: ${stats.insecure}`);

  for (const policy of stats.policies) {
    const icon = policy.isInsecure ? '  🔴' : '  ✅';
    console.log(`${icon} ${policy.operation}: ${policy.policyName}`);
    if (policy.isInsecure) {
      console.log(`      USING (true) ← 誰でもアクセス可能`);
    } else {
      const shortClause = policy.usingClause.substring(0, 60);
      console.log(`      USING (${shortClause}${policy.usingClause.length > 60 ? '...' : ''})`);
    }
  }
  console.log('');
}

// 危険なポリシーの詳細
if (insecurePolicies.length > 0) {
  console.log('===========================================');
  console.log('🔴 危険なポリシー詳細 (USING true)');
  console.log('-------------------------------------------');
  console.log('');

  const groupedByTable = {};
  for (const policy of insecurePolicies) {
    if (!groupedByTable[policy.tableName]) {
      groupedByTable[policy.tableName] = [];
    }
    groupedByTable[policy.tableName].push(policy);
  }

  for (const [tableName, policies] of Object.entries(groupedByTable)) {
    console.log(`📊 ${tableName} (${policies.length}件)`);
    console.log('-------------------------------------------');
    for (const policy of policies) {
      console.log(`  ポリシー名: ${policy.policyName}`);
      console.log(`  操作: ${policy.operation}`);
      console.log(`  ファイル: ${policy.file}`);
      console.log(`  USING: (true) ← 🔴 誰でもアクセス可能`);
      console.log('');
    }
  }

  console.log('【セキュリティリスク】');
  console.log('  - ANON_KEY を持つ誰でも全データにアクセス可能');
  console.log('  - クライアント側のコード改変で他人のデータが閲覧・変更可能');
  console.log('  - ブラウザDevToolsで .eq() フィルタを削除すれば全件取得可能');
  console.log('');

  console.log('【推奨対策】');
  console.log('  1. Doc 62B を参照してセキュリティ対策を実施');
  console.log('  2. サーバーサイドAPI経由への移行（推奨）');
  console.log('  3. RLSポリシーを厳格化（auth.jwt() または カスタムロジック）');
  console.log('');
} else {
  console.log('===========================================');
  console.log('✅ すべてのポリシーが安全です');
  console.log('-------------------------------------------');
  console.log('  USING (true) のポリシーは検出されませんでした。');
  console.log('');
}

// SQLファイル別の危険度
console.log('===========================================');
console.log('📁 SQLファイル別の危険度');
console.log('-------------------------------------------');

const fileRisks = {};
for (const policy of rlsPolicies) {
  if (!fileRisks[policy.file]) {
    fileRisks[policy.file] = { total: 0, insecure: 0 };
  }
  fileRisks[policy.file].total++;
  if (policy.isInsecure) {
    fileRisks[policy.file].insecure++;
  }
}

for (const file of sqlFiles) {
  const risk = fileRisks[file];
  if (!risk) {
    console.log(`  ℹ️  ${file} - RLSポリシーなし`);
  } else if (risk.insecure > 0) {
    console.log(`  🔴 ${file} - ${risk.insecure}/${risk.total} 件が危険`);
  } else {
    console.log(`  ✅ ${file} - ${risk.total}件すべて安全`);
  }
}
console.log('');

// 修正が必要なファイルリスト
if (insecurePolicies.length > 0) {
  const filesToFix = [...new Set(insecurePolicies.map(p => p.file))];
  console.log('🔧 修正が必要なファイル:');
  console.log('-------------------------------------------');
  for (const file of filesToFix) {
    console.log(`  - supabase/${file}`);
  }
  console.log('');
}

console.log('===========================================\n');
