import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const problemUsers = [
  { ticket: "1019", name: "谷田部寿恵", userId: "Uac592c34b6d9d9dc84dbe9cc2c94f2c2" },
  { ticket: "7766", name: "あもう", userId: "U8935d0891e61a4b55ab93dd8b3e4c515" },
];

async function analyzeEnvironment() {
  console.log("🔍 診察券1019・7766の環境情報分析\n");
  console.log("=" .repeat(80));

  for (const user of problemUsers) {
    console.log(`\n📋 診察券${user.ticket}（${user.name}）`);
    console.log("-".repeat(80));

    // プロフィール情報
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.userId)
      .single();

    if (profile) {
      console.log(`\n👤 プロフィール情報:`);
      console.log(`   LINE User ID: ${profile.line_user_id || profile.id}`);
      console.log(`   登録日: ${new Date(profile.created_at).toLocaleString("ja-JP")}`);
      console.log(`   OS: ${profile.os || "不明"}`);
      console.log(`   デバイス: ${profile.device || "不明"}`);
      console.log(`   ブラウザ: ${profile.browser || "不明"}`);
      console.log(`   User-Agent: ${profile.user_agent ? profile.user_agent.substring(0, 100) + "..." : "不明"}`);
    }

    // 4/7のevent_logs取得
    const { data: eventLogs } = await supabase
      .from("event_logs")
      .select("*")
      .eq("user_id", user.userId)
      .gte("created_at", "2026-04-07T00:00:00Z")
      .lt("created_at", "2026-04-08T00:00:00Z")
      .order("created_at", { ascending: true });

    console.log(`\n📊 4/7のイベントログ（${eventLogs?.length || 0}件）:`);
    if (eventLogs && eventLogs.length > 0) {
      eventLogs.forEach((log, index) => {
        const time = new Date(log.created_at).toLocaleTimeString("ja-JP");
        console.log(`\n[${index + 1}] ${time} - ${log.event_type}`);
        console.log(`    流入元: ${log.entry_point || "不明"}`);

        // メタデータを詳細表示
        if (log.metadata) {
          const meta = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata;
          console.log(`    メタデータ:`);

          // デバイス情報
          if (meta.device) console.log(`      デバイス: ${meta.device}`);
          if (meta.os) console.log(`      OS: ${meta.os}`);
          if (meta.browser) console.log(`      ブラウザ: ${meta.browser}`);
          if (meta.liff_browser) console.log(`      LIFFブラウザ: ${meta.liff_browser}`);
          if (meta.is_in_client) console.log(`      LINEアプリ内: ${meta.is_in_client}`);

          // スタンプ関連
          if (meta.stamp_method) console.log(`      スタンプ方法: ${meta.stamp_method}`);
          if (meta.location) console.log(`      場所: ${meta.location}`);
          if (meta.amount) console.log(`      ポイント数: ${meta.amount}`);
          if (meta.current_stamp_count !== undefined) console.log(`      現在のスタンプ: ${meta.current_stamp_count}`);
          if (meta.change_amount !== undefined) console.log(`      変化量: ${meta.change_amount}`);

          // referrer情報
          if (meta.referrer) console.log(`      referrer: ${meta.referrer}`);
          if (meta.page_path) console.log(`      page_path: ${meta.page_path}`);

          // その他の重要な情報
          if (meta.user_agent) console.log(`      User-Agent: ${meta.user_agent.substring(0, 80)}...`);
        }
      });
    } else {
      console.log(`   ❌ イベントログなし`);
    }

    // 全期間のstamp_history（15ポイント問題のある記録だけ）
    const { data: stampHistory } = await supabase
      .from("stamp_history")
      .select("*")
      .eq("user_id", user.userId)
      .order("created_at", { ascending: true });

    console.log(`\n📊 スタンプ履歴分析:`);
    if (stampHistory && stampHistory.length > 0) {
      const problemRecord = stampHistory.find(r =>
        r.qr_code_id && r.qr_code_id.includes("amount=15") && r.amount === 10
      );

      if (problemRecord) {
        console.log(`\n   ⚠️ 問題の記録を発見:`);
        console.log(`      日時: ${new Date(problemRecord.visit_date).toLocaleString("ja-JP")}`);
        console.log(`      QR URL: ${problemRecord.qr_code_id}`);
        console.log(`      期待ポイント: 15`);
        console.log(`      実際の付与: ${problemRecord.amount}`);
        console.log(`      メモ: ${problemRecord.notes}`);
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n🔍 正常なユーザーのサンプル比較\n");
  console.log("=".repeat(80));

  // 4/7に正常にスタンプを取得したユーザーをサンプル抽出
  const { data: normalUsers } = await supabase
    .from("stamp_history")
    .select("user_id, amount, qr_code_id, visit_date")
    .gte("visit_date", "2026-04-07T00:00:00Z")
    .lt("visit_date", "2026-04-08T00:00:00Z")
    .eq("stamp_method", "qr")
    .limit(10);

  if (normalUsers && normalUsers.length > 0) {
    console.log(`\n📊 4/7にスタンプ取得した他のユーザー（サンプル${normalUsers.length}件）:\n`);

    for (const record of normalUsers) {
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("display_name, os, device, browser, ticket_number")
        .eq("id", record.user_id)
        .single();

      if (userProfile) {
        const time = new Date(record.visit_date).toLocaleTimeString("ja-JP");
        console.log(`   ${time} - ${userProfile.display_name} (診察券${userProfile.ticket_number})`);
        console.log(`      付与ポイント: ${record.amount}`);
        console.log(`      QR ID: ${record.qr_code_id ? record.qr_code_id.substring(0, 60) + "..." : "なし"}`);
        console.log(`      OS: ${userProfile.os || "不明"}, デバイス: ${userProfile.device || "不明"}`);

        // amount=15のQRを正常に読み取ったユーザーがいるか確認
        if (record.qr_code_id && record.qr_code_id.includes("amount=15") && record.amount === 15) {
          console.log(`      ✅ 15ポイントQRを正常に読み取り成功！`);
        }
        console.log();
      }
    }
  }

  console.log("=".repeat(80));
}

analyzeEnvironment().catch(console.error);
