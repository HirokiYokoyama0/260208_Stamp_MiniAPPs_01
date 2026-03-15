import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/stamps/auto
 * アクション付きQRコード専用のスタンプ自動付与API
 *
 * Body:
 * - userId: ユーザーID
 * - amount: スタンプ数 (5 or 10)
 * - type: "qr" (固定)
 * - location: "premium" | "standard" (オプション)
 */
export async function POST(req: Request) {
  try {
    const { userId, amount, type, location } = await req.json();

    // バリデーション
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "ユーザーIDが必要です" },
        { status: 400 }
      );
    }

    if (type !== "qr") {
      return NextResponse.json(
        { success: false, message: "無効なスタンプタイプです" },
        { status: 400 }
      );
    }

    if (![5, 10].includes(amount)) {
      return NextResponse.json(
        { success: false, message: "スタンプ数は5または10である必要があります" },
        { status: 400 }
      );
    }

    // 1日1回制限チェック
    const today = new Date().toISOString().split("T")[0];
    const { data: todayRecords, error: checkError } = await supabase
      .from("stamp_history")
      .select("*")
      .eq("user_id", userId)
      .eq("stamp_method", "qr")
      .gte("visit_date", today)
      .lt("visit_date", `${today}T23:59:59.999Z`);

    if (checkError) {
      console.error("❌ 1日1回チェックエラー:", checkError);
      return NextResponse.json(
        { success: false, message: "チェックに失敗しました" },
        { status: 500 }
      );
    }

    if (todayRecords && todayRecords.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "本日は既にQRコードでスタンプを受け取っています",
          alreadyReceived: true
        },
        { status: 400 }
      );
    }

    // 現在のスタンプ数を取得
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stamp_count")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("❌ プロフィール取得エラー:", profileError);
      return NextResponse.json(
        { success: false, message: "ユーザー情報の取得に失敗しました" },
        { status: 500 }
      );
    }

    const currentStampCount = profile.stamp_count || 0;
    const newStampNumber = currentStampCount + amount;

    // stamp_historyに記録を追加
    const { data: historyData, error: historyError } = await supabase
      .from("stamp_history")
      .insert({
        user_id: userId,
        stamp_method: "qr",
        amount: amount,
        stamp_number: newStampNumber,
        visit_date: new Date().toISOString(),
        notes: location ? `QRスタンプ (${location})` : "QRスタンプ",
      })
      .select()
      .single();

    if (historyError) {
      console.error("❌ スタンプ履歴追加エラー:", historyError);
      return NextResponse.json(
        { success: false, message: "スタンプの記録に失敗しました" },
        { status: 500 }
      );
    }

    // profilesのstamp_countを更新
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        stamp_count: newStampNumber,
        last_visit_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("❌ プロフィール更新エラー:", updateError);
      return NextResponse.json(
        { success: false, message: "スタンプ数の更新に失敗しました" },
        { status: 500 }
      );
    }

    console.log(`✅ QRスタンプ自動付与成功: ${userId} (+${amount}個 → 合計${newStampNumber}個)`);

    return NextResponse.json({
      success: true,
      stampCount: newStampNumber,
      addedAmount: amount,
      message: `スタンプを${amount}個獲得しました！`,
    });

  } catch (error) {
    console.error("❌ QRスタンプ自動付与エラー:", error);
    return NextResponse.json(
      { success: false, message: "エラーが発生しました" },
      { status: 500 }
    );
  }
}
