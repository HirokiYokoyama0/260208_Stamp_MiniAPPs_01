/**
 * Supabase接続テスト
 *
 * 実行方法:
 * npx tsx test/supabase-connection.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// .env.localファイルを読み込む
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("===========================================");
console.log("🧪 Supabase 接続テスト");
console.log("===========================================\n");

// 環境変数のチェック
console.log("📋 環境変数チェック:");
console.log(`  NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? "✅ 設定済み" : "❌ 未設定"}`);
console.log(`  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? "✅ 設定済み" : "❌ 未設定"}`);
console.log();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ エラー: 環境変数が設定されていません。");
  console.log("\n📝 設定方法:");
  console.log("  1. .env.local ファイルを作成");
  console.log("  2. 以下の内容を追加:");
  console.log("     NEXT_PUBLIC_SUPABASE_URL=your-project-url");
  console.log("     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key\n");
  process.exit(1);
}

// Supabaseクライアント初期化
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    console.log("🔌 接続テスト中...\n");

    // テスト1: データベース接続確認
    console.log("📊 テスト1: データベース接続確認");
    const { data: healthCheck, error: healthError } = await supabase
      .from("profiles")
      .select("count")
      .limit(1);

    if (healthError) {
      if (healthError.code === "PGRST116") {
        console.log("  ⚠️  'profiles' テーブルがまだ作成されていません");
        console.log("  💡 Supabase SQLエディタで以下のSQLを実行してください:\n");
        console.log(`
CREATE TABLE profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_user_id TEXT UNIQUE NOT NULL,
  display_name TEXT,
  picture_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert"
  ON profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update"
  ON profiles FOR UPDATE
  USING (true);
        `);
      } else {
        console.log(`  ❌ エラー: ${healthError.message}`);
        console.log(`  コード: ${healthError.code}`);
      }
    } else {
      console.log("  ✅ データベース接続成功！");
    }
    console.log();

    // テスト2: テストデータの挿入
    console.log("📝 テスト2: テストデータの挿入");
    const testUserId = `U_test_${Date.now()}`;
    const testUser = {
      id: testUserId, // 主キーとしてLINEユーザーIDを使用
      line_user_id: testUserId,
      display_name: "テストユーザー",
      picture_url: "https://example.com/avatar.jpg",
    };

    const { data: insertData, error: insertError } = await supabase
      .from("profiles")
      .insert(testUser)
      .select();

    if (insertError) {
      console.log(`  ❌ 挿入エラー: ${insertError.message}`);
    } else {
      console.log("  ✅ テストデータの挿入成功！");
      console.log(`  挿入されたデータ:`, insertData);
    }
    console.log();

    // テスト3: データの取得
    console.log("📖 テスト3: データの取得");
    const { data: selectData, error: selectError } = await supabase
      .from("profiles")
      .select("*")
      .eq("line_user_id", testUser.line_user_id)
      .single();

    if (selectError) {
      console.log(`  ❌ 取得エラー: ${selectError.message}`);
    } else {
      console.log("  ✅ データの取得成功！");
      console.log(`  取得されたデータ:`, selectData);
    }
    console.log();

    // テスト4: データの更新
    console.log("✏️  テスト4: データの更新（UPSERT）");
    const { data: upsertData, error: upsertError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: testUser.id, // 主キーで更新
          line_user_id: testUser.line_user_id,
          display_name: "更新されたテストユーザー",
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id", // idで重複チェック
        }
      )
      .select();

    if (upsertError) {
      console.log(`  ❌ 更新エラー: ${upsertError.message}`);
    } else {
      console.log("  ✅ データの更新成功！");
      console.log(`  更新されたデータ:`, upsertData);
    }
    console.log();

    // テスト5: テストデータの削除
    console.log("🗑️  テスト5: テストデータの削除");
    const { error: deleteError } = await supabase
      .from("profiles")
      .delete()
      .eq("line_user_id", testUser.line_user_id);

    if (deleteError) {
      console.log(`  ❌ 削除エラー: ${deleteError.message}`);
    } else {
      console.log("  ✅ テストデータの削除成功！");
    }
    console.log();

    console.log("===========================================");
    console.log("🎉 すべてのテストが完了しました！");
    console.log("===========================================");
  } catch (error) {
    console.error("\n❌ 予期しないエラーが発生しました:", error);
    process.exit(1);
  }
}

// テスト実行
testConnection();
