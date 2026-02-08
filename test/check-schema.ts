/**
 * Supabase テーブルスキーマ確認
 *
 * 実行方法:
 * npx tsx test/check-schema.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  console.log("===========================================");
  console.log("🔍 Supabase テーブルスキーマ確認");
  console.log("===========================================\n");

  try {
    // profilesテーブルから1件取得してカラムを確認
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .limit(1);

    if (error) {
      console.log("❌ エラー:", error.message);
      return;
    }

    if (!data || data.length === 0) {
      console.log("⚠️  テーブルは存在しますが、データがありません。");
      console.log("\n💡 必要なカラム構造:");
      console.log("  - id (UUID, PRIMARY KEY)");
      console.log("  - line_user_id (TEXT, UNIQUE, NOT NULL)");
      console.log("  - display_name (TEXT)");
      console.log("  - picture_url (TEXT) ← 不足している可能性");
      console.log("  - created_at (TIMESTAMPTZ)");
      console.log("  - updated_at (TIMESTAMPTZ) ← 不足している可能性");
    } else {
      console.log("✅ 既存データ:");
      console.log(JSON.stringify(data[0], null, 2));
      console.log("\n📋 現在のカラム一覧:");
      Object.keys(data[0]).forEach((key) => {
        console.log(`  - ${key}`);
      });
    }

    console.log("\n\n📝 推奨SQL:");
    console.log(`
-- 不足しているカラムを追加
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS picture_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- created_atがない場合は追加
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- インデックスの追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_profiles_line_user_id
  ON profiles(line_user_id);
    `);
  } catch (error) {
    console.error("❌ エラー:", error);
  }
}

checkSchema();
