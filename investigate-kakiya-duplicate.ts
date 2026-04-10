import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log("🚨 垣矢直子さんのポイント二重付与問題調査\n");
console.log("=" .repeat(80));

async function investigate() {
  console.log("\n🔍 問題の概要:");
  console.log("  4/6: 5ポイントQR読み込み → 10ポイント付与（5ポイント多い）");
  console.log("  4/7朝: 10ポイント → 15ポイントに増加（さらに5ポイント増加）");
  console.log("  4/7: 管理画面から5ポイントに手動修正済み\n");
  console.log("=" .repeat(80));

  // 垣矢直子さんを検索（ユーザーから提供されたIDを直接使用）
  console.log("\n📋 ステップ1: 垣矢直子さんのプロフィール検索\n");

  const targetUserId = "U2b2d1cae3671441af8fdd810effba348";
  console.log(`🔍 対象ユーザーID: ${targetUserId}\n`);

  const { data: targetProfile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", targetUserId)
    .single();

  if (profileError) {
    console.error("❌ プロフィール取得エラー:", profileError);
    return;
  }

  if (!targetProfile) {
    console.log("❌ 垣矢さんが見つかりません");
    return;
  }

  console.log(`✅ プロフィール確認:\n`);
  console.log(`名前: ${targetProfile.real_name || targetProfile.display_name || "名前なし"}`);
  console.log(`診察券番号: ${targetProfile.ticket_number || "なし"}`);
  console.log(`User ID: ${targetProfile.id}`);
  console.log(`LINE User ID: ${targetProfile.line_user_id}`);
  console.log(`現在のスタンプ数: ${targetProfile.stamp_count}個`);
  console.log(`来院回数: ${targetProfile.visit_count}回`);
  console.log(`登録日時: ${new Date(targetProfile.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} (JST)`);
  console.log("");

  // メインの対象者を特定
  const target = targetProfile;
  const userId = target.id; // profiles.id を使用（LINE User IDと同じ値）

  console.log("=" .repeat(80));
  console.log(`\n📊 ステップ2: ${target.real_name || "名前なし"}さんのスタンプ履歴確認\n`);

  // スタンプ履歴を取得（全期間 - まず全体を把握）
  const { data: stampHistoryAll } = await supabase
    .from("stamp_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  console.log(`📊 stamp_history（全期間）\n`);
  if (stampHistoryAll && stampHistoryAll.length > 0) {
    console.log(`✅ ${stampHistoryAll.length}件の履歴\n`);

    stampHistoryAll.forEach((s, i) => {
      const jstTime = new Date(s.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

      console.log(`[${i + 1}] ${jstTime} (JST)`);
      console.log(`    付与後累計: ${s.stamp_number}個`);
      console.log(`    今回変化: ${s.amount > 0 ? "+" : ""}${s.amount}個`);
      console.log(`    方法: ${s.stamp_method || "不明"}`);
      console.log(`    メモ: ${s.notes || "なし"}`);
      console.log(`    QR ID: ${s.qr_code_id || "なし"}`);
      console.log(`    ID: ${s.id}`);
      console.log("");
    });
  } else {
    console.log("❌ スタンプ履歴が見つかりません\n");
  }

  // 4/6-4/7のみ抽出
  const stampHistory = stampHistoryAll?.filter((s) => {
    const created = new Date(s.created_at);
    const start = new Date("2026-04-06T00:00:00Z");
    const end = new Date("2026-04-07T23:59:59Z");
    return created >= start && created <= end;
  }) || [];

  console.log("=" .repeat(80));
  console.log(`\n📊 stamp_history（4/6-4/7のみ）\n`);
  if (stampHistory.length > 0) {
    console.log(`✅ ${stampHistory.length}件\n`);
  } else {
    console.log("⚠️ 該当期間の履歴なし\n");
  }

  // イベントログを確認
  console.log("=" .repeat(80));
  console.log("\n📊 ステップ3: イベントログ確認（4/6-4/7）\n");

  const { data: eventLogs } = await supabase
    .from("event_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", "2026-04-06T00:00:00Z")
    .lte("created_at", "2026-04-07T23:59:59Z")
    .order("created_at", { ascending: true });

  if (eventLogs && eventLogs.length > 0) {
    console.log(`✅ イベントログ: ${eventLogs.length}件\n`);

    eventLogs.forEach((e, i) => {
      const jstTime = new Date(e.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
      console.log(`[${i + 1}] ${jstTime} (JST)`);
      console.log(`    イベント: ${e.event_name}`);
      console.log(`    流入元: ${e.source || "不明"}`);
      console.log(`    メタデータ: ${JSON.stringify(e.metadata || {}, null, 2)}`);
      console.log(`    ID: ${e.id}`);
      console.log("");
    });
  } else {
    console.log("❌ イベントログが見つかりません\n");
  }

  // QRスキャン履歴を確認
  console.log("=" .repeat(80));
  console.log("\n📊 ステップ4: 同時刻のQRスキャン重複確認\n");

  if (stampHistoryAll && stampHistoryAll.length > 1) {
    let foundDuplicate = false;
    // 同じ時刻（5秒以内）に複数のスタンプ付与があるか確認
    for (let i = 0; i < stampHistoryAll.length - 1; i++) {
      const current = stampHistoryAll[i];
      const next = stampHistoryAll[i + 1];

      const currentTime = new Date(current.created_at).getTime();
      const nextTime = new Date(next.created_at).getTime();
      const diff = nextTime - currentTime;

      if (diff < 5000) { // 5秒以内
        foundDuplicate = true;
        console.log(`⚠️ 重複の可能性を検出！\n`);
        console.log(`  [1] ${new Date(current.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} (JST)`);
        console.log(`      付与後累計: ${current.stamp_number}個`);
        console.log(`      変化量: ${current.amount > 0 ? "+" : ""}${current.amount}個`);
        console.log(`      方法: ${current.stamp_method}`);
        console.log(`      QR ID: ${current.qr_code_id || "なし"}`);
        console.log(`  [2] ${new Date(next.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} (JST)`);
        console.log(`      付与後累計: ${next.stamp_number}個`);
        console.log(`      変化量: ${next.amount > 0 ? "+" : ""}${next.amount}個`);
        console.log(`      方法: ${next.stamp_method}`);
        console.log(`      QR ID: ${next.qr_code_id || "なし"}`);
        console.log(`  ⏱️ 時間差: ${diff}ms\n`);
      }
    }

    if (!foundDuplicate) {
      console.log("✅ 5秒以内の重複スキャンなし\n");
    }
  } else {
    console.log("⚠️ 比較するデータが不足\n");
  }

  // マイルストーン到達履歴を確認
  console.log("=" .repeat(80));
  console.log("\n📊 ステップ5: マイルストーン到達履歴の確認\n");

  const { data: milestones } = await supabase
    .from("milestone_history")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", "2026-04-06T00:00:00Z")
    .lte("created_at", "2026-04-07T23:59:59Z")
    .order("created_at", { ascending: true });

  if (milestones && milestones.length > 0) {
    console.log(`⚠️ マイルストーン到達履歴: ${milestones.length}件\n`);

    milestones.forEach((m, i) => {
      const jstTime = new Date(m.reached_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
      console.log(`[${i + 1}] ${jstTime} (JST)`);
      console.log(`    マイルストーン: ${m.milestone}個`);
      console.log(`    特典交換ID: ${m.reward_exchange_id || "なし"}`);
      console.log(`    到達日時: ${jstTime}`);
      console.log(`    ID: ${m.id}`);
      console.log("");
    });
  } else {
    console.log("✅ マイルストーン到達なし（4/6-4/7）\n");
  }

  // 現在の状態を確認
  console.log("=" .repeat(80));
  console.log("\n📊 ステップ6: 現在の状態確認\n");

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (currentProfile) {
    console.log(`現在のスタンプ数: ${currentProfile.stamp_count}個`);
    console.log(`来院回数: ${currentProfile.visit_count}回`);
    console.log(`最終来院日: ${currentProfile.last_visit_date ? new Date(currentProfile.last_visit_date).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "なし"}`);
    console.log(`最終更新: ${new Date(currentProfile.updated_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} (JST)\n`);
  }

  // データ整合性チェック
  console.log("=" .repeat(80));
  console.log("\n🔍 データ整合性チェック\n");

  if (stampHistoryAll && stampHistoryAll.length > 0) {
    const maxStampNumber = Math.max(...stampHistoryAll.map(s => s.stamp_number));
    const currentStampCount = currentProfile?.stamp_count || 0;

    console.log(`stamp_history の MAX(stamp_number): ${maxStampNumber}個`);
    console.log(`profiles.stamp_count: ${currentStampCount}個`);

    if (maxStampNumber === currentStampCount) {
      console.log(`✅ 整合性: 一致\n`);
    } else {
      console.log(`❌ 整合性: 不一致！（差分: ${currentStampCount - maxStampNumber}個）\n`);
    }
  }

  // まとめ
  console.log("=" .repeat(80));
  console.log("\n🔍 分析結果\n");

  if (stampHistory && stampHistory.length > 0) {
    const totalChange = stampHistory.reduce((sum, s) => sum + s.amount, 0);
    console.log(`期間中（4/6-4/7）の合計変化量: ${totalChange > 0 ? "+" : ""}${totalChange}個`);
    console.log(`QRスキャン: ${stampHistory.filter(s => s.stamp_method === "qr_scan" || s.stamp_method === "purchase_incentive").length}回`);
    console.log(`手動調整: ${stampHistory.filter(s => s.stamp_method === "manual_admin").length}回\n`);
  } else {
    console.log(`期間中（4/6-4/7）の履歴: 0件\n`);
  }

  console.log("🚨 問題の原因候補:");
  console.log("  1. /api/stamps/auto が profiles.stamp_count を直接UPDATEしている");
  console.log("  2. stamp_history への INSERT が失敗したが profiles の更新は成功した");
  console.log("  3. トランザクションの不整合（部分的なコミット）");
  console.log("  4. フロントエンドでの二重送信（同一秒に複数回API呼び出し）");
  console.log("  5. 1日1回制限が機能していない（106秒後に再スキャン成功）\n");

  console.log("=" .repeat(80));
}

investigate().catch(console.error);
