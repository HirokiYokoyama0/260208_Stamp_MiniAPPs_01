import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { GetRewardsResponse, Reward } from "@/types/reward";

/**
 * GET /api/rewards
 * 有効な特典一覧を取得
 */
export async function GET(): Promise<NextResponse<GetRewardsResponse>> {
  try {
    const { data, error } = await supabase
      .from("rewards")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("❌ 特典一覧取得エラー:", error);
      return NextResponse.json(
        {
          success: false,
          rewards: [],
          error: error.message,
        },
        { status: 500 }
      );
    }

    console.log(`✅ 特典一覧を取得しました（${data.length}件）`);

    return NextResponse.json(
      {
        success: true,
        rewards: data as Reward[],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ 特典一覧取得API エラー:", error);
    return NextResponse.json(
      {
        success: false,
        rewards: [],
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
