import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function analyzeImpact() {
  console.log('🔍 家族スタンプ合算によるマイルストーン判定の影響分析\n');

  // 1. 全ユーザーの家族状態を確認
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('id, display_name, stamp_count, family_id, family_role, line_user_id')
    .order('stamp_count', { ascending: false });

  if (!allProfiles) {
    console.log('❌ プロフィールデータの取得に失敗');
    return;
  }

  console.log(`📊 全ユーザー数: ${allProfiles.length}人\n`);

  // 2. 家族IDごとにグループ化
  const familyGroups = new Map();
  const noFamilyUsers = [];

  for (const profile of allProfiles) {
    if (profile.family_id) {
      if (!familyGroups.has(profile.family_id)) {
        familyGroups.set(profile.family_id, []);
      }
      familyGroups.get(profile.family_id).push(profile);
    } else {
      noFamilyUsers.push(profile);
    }
  }

  console.log(`📊 家族の分類:`);
  console.log(`  家族あり: ${familyGroups.size}家族`);
  console.log(`  家族なし（単身者）: ${noFamilyUsers.length}人\n`);

  // 3. 単身者（family_id = NULL）への影響
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 単身者（family_id = NULL）への影響\n`);

  if (noFamilyUsers.length > 0) {
    console.log(`単身者の例（上位5人）:`);
    console.table(noFamilyUsers.slice(0, 5).map(u => ({
      display_name: u.display_name,
      stamp_count: u.stamp_count,
      family_id: u.family_id,
      has_line: u.line_user_id ? 'あり' : 'なし'
    })));

    console.log(`\n✅ 単身者への影響:`);
    console.log(`  - family_id = NULL の場合`);
    console.log(`  - effectiveStampCount = profile.stamp_count（個人スタンプ数）`);
    console.log(`  - マイルストーン判定: 個人スタンプ数で判定（現在と同じ）`);
    console.log(`  - 影響: なし ✅\n`);
  } else {
    console.log(`✅ 単身者は0人です（全員が家族に所属）\n`);
  }

  // 4. 1人家族（member_count = 1）への影響
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 1人家族（member_count = 1）への影響\n`);

  const singleMemberFamilies = [];
  for (const [familyId, members] of familyGroups.entries()) {
    if (members.length === 1) {
      singleMemberFamilies.push({ familyId, member: members[0] });
    }
  }

  if (singleMemberFamilies.length > 0) {
    console.log(`1人家族の数: ${singleMemberFamilies.length}家族\n`);
    console.log(`1人家族の例（上位5人）:`);
    console.table(singleMemberFamilies.slice(0, 5).map(f => ({
      display_name: f.member.display_name,
      stamp_count: f.member.stamp_count,
      family_id: f.familyId.substring(0, 20) + '...',
      family_role: f.member.family_role
    })));

    // family_stamp_totals で合算値を確認
    const sampleFamilyId = singleMemberFamilies[0].familyId;
    const { data: familyTotal } = await supabase
      .from('family_stamp_totals')
      .select('*')
      .eq('family_id', sampleFamilyId)
      .single();

    console.log(`\n📊 1人家族のfamily_stamp_totals（サンプル）:`);
    console.log({
      family_name: familyTotal?.family_name,
      member_count: familyTotal?.member_count,
      total_stamp_count: familyTotal?.total_stamp_count,
      個人stamp_count: singleMemberFamilies[0].member.stamp_count
    });

    console.log(`\n✅ 1人家族への影響:`);
    console.log(`  - family_id 存在 + member_count = 1`);
    console.log(`  - effectiveStampCount = family_stamp_totals.total_stamp_count`);
    console.log(`  - total_stamp_count = 個人のstamp_count（同じ値）`);
    console.log(`  - マイルストーン判定: 家族合算値で判定（実質個人スタンプと同じ）`);
    console.log(`  - 影響: なし ✅\n`);
  } else {
    console.log(`1人家族は0人です\n`);
  }

  // 5. 2人以上の家族への影響
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 2人以上の家族への影響\n`);

  const multiFamilies = [];
  for (const [familyId, members] of familyGroups.entries()) {
    if (members.length >= 2) {
      multiFamilies.push({ familyId, members });
    }
  }

  console.log(`2人以上の家族: ${multiFamilies.length}家族\n`);

  if (multiFamilies.length > 0) {
    // 各家族の詳細を確認
    for (let i = 0; i < Math.min(3, multiFamilies.length); i++) {
      const family = multiFamilies[i];
      const { data: familyTotal } = await supabase
        .from('family_stamp_totals')
        .select('*')
        .eq('family_id', family.familyId)
        .single();

      console.log(`\n[家族${i + 1}: ${familyTotal?.family_name}]`);
      console.log(`  メンバー数: ${family.members.length}人`);
      console.log(`  家族合算スタンプ: ${familyTotal?.total_stamp_count}個\n`);

      console.table(family.members.map(m => ({
        名前: m.display_name,
        個人スタンプ: m.stamp_count,
        役割: m.family_role,
        LINE有: m.line_user_id ? 'あり' : 'なし'
      })));

      // 現在の実装 vs 修正後の実装
      console.log(`  📊 マイルストーン判定への影響:`);
      for (const member of family.members) {
        const currentMilestones = Math.floor(member.stamp_count / 10);
        const newMilestones = Math.floor((familyTotal?.total_stamp_count || 0) / 10);

        console.log(`    - ${member.display_name}:`);
        console.log(`      現在: ${member.stamp_count}個 → ${currentMilestones}個までのマイルストーン`);
        console.log(`      修正後: ${familyTotal?.total_stamp_count}個 → ${newMilestones}個までのマイルストーン`);
        if (newMilestones > currentMilestones) {
          console.log(`      ⚠️ 影響: +${newMilestones - currentMilestones}個のマイルストーン追加付与される`);
        } else if (newMilestones < currentMilestones) {
          console.log(`      ⚠️ 影響: ${currentMilestones - newMilestones}個のマイルストーン少なくなる（あり得ない）`);
        } else {
          console.log(`      ✅ 影響: なし（同じ）`);
        }
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n⚠️ 2人以上の家族への影響まとめ:`);
    console.log(`  - family_id 存在 + member_count >= 2`);
    console.log(`  - effectiveStampCount = family_stamp_totals.total_stamp_count`);
    console.log(`  - マイルストーン判定: 家族合算値で判定（変更あり）`);
    console.log(`  - 影響: 家族合算により、個人より多くのマイルストーンに到達する可能性 ⚠️\n`);
  }

  // 6. 結論
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📝 結論\n`);
  console.log(`✅ 単身者（family_id = NULL）への影響:`);
  console.log(`   → なし（個人スタンプ数で判定、現在と同じ）\n`);
  console.log(`✅ 1人家族（member_count = 1）への影響:`);
  console.log(`   → なし（family_stamp_totals.total_stamp_count = 個人スタンプ数）\n`);
  console.log(`⚠️ 2人以上の家族（member_count >= 2）への影響:`);
  console.log(`   → 家族合算により、より多くのマイルストーンに到達`);
  console.log(`   → これは仕様通りの動作（意図的な設計）\n`);
}

analyzeImpact().catch(console.error);
