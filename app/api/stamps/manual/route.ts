import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { AddStampResponse } from "@/types/stamp";

interface ManualStampRequest {
  userId: string; // LINEユーザーID
  staffPin: string; // スタッフ暗証番号
  newStampCount: number; // 新しいスタンプ数
}

/**
 * POST /api/stamps/manual
 * スタッフ手動スタンプ数変更エンドポイント
 *
 * 機能:
 * - スタッフがユーザーのスタンプ数を任意の値に変更できる
 * - 1日1回制限なし（何度でも変更可能）
 * - 監査証跡としてstamp_historyに記録
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<AddStampResponse>> {
  try {
    const body: ManualStampRequest = await request.json();
    const { userId, staffPin, newStampCount } = body;

    // バリデーション
    if (!userId || !staffPin || newStampCount === undefined) {
      return NextResponse.json(
        {
          success: false,
          message: "必要なパラメータが不足しています",
          error: "Missing required fields",
        },
        { status: 400 }
      );
    }

    // スタンプ数のバリデーション
    if (newStampCount < 0 || newStampCount > 999) {
      return NextResponse.json(
        {
          success: false,
          message: "スタンプ数は0～999の範囲で指定してください",
          error: "Invalid stamp count",
        },
        { status: 400 }
      );
    }

    // 暗証番号の検証
    const correctPin = process.env.NEXT_PUBLIC_STAFF_PIN || "1234";
    if (staffPin !== correctPin) {
      console.error("❌ 暗証番号エラー: 入力値が一致しません");
      return NextResponse.json(
        {
          success: false,
          message: "暗証番号が間違っています",
          error: "Invalid PIN",
        },
        { status: 401 }
      );
    }

    // 現在のスタンプ数を取得
    const { data: profileData, error: fetchError } = await supabase
      .from("profiles")
      .select("stamp_count")
      .eq("id", userId)
      .single();

    if (fetchError) {
      console.error("ユーザープロフィール取得エラー:", fetchError);
      return NextResponse.json(
        {
          success: false,
          message: "ユーザー情報の取得に失敗しました",
          error: fetchError.message,
        },
        { status: 404 }
      );
    }

    const currentStampCount = profileData?.stamp_count ?? 0;

    // スタンプ数が変更されていない場合
    if (currentStampCount === newStampCount) {
      return NextResponse.json(
        {
          success: true,
          message: "スタンプ数は既に同じ値です",
          stampCount: currentStampCount,
        },
        { status: 200 }
      );
    }

    // スタンプ数を減らす場合、新しい値より大きいstamp_historyレコードを削除
    // これにより、トリガーが MAX(stamp_number) を計算した際に新しい値になる
    // 注: DELETEにはSERVICE_ROLE_KEYが必要（RLSポリシーでANON_KEYはDELETE不可）
    if (newStampCount < currentStampCount) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceRoleKey) {
        console.error("❌ Supabase環境変数が設定されていません");
        return NextResponse.json(
          {
            success: false,
            message: "サーバー設定エラー",
            error: "Missing Supabase credentials",
          },
          { status: 500 }
        );
      }

      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

      const { error: deleteError, count } = await supabaseAdmin
        .from("stamp_history")
        .delete({ count: 'exact' })
        .eq("user_id", userId)
        .gt("stamp_number", newStampCount);

      if (deleteError) {
        console.error("過去の履歴削除エラー:", deleteError);
        return NextResponse.json(
          {
            success: false,
            message: "履歴の削除に失敗しました",
            error: deleteError.message,
          },
          { status: 500 }
        );
      }

      console.log(`🗑️ stamp_number > ${newStampCount} のレコードを ${count}件 削除しました`);
    }

    // 監査証跡を記録（stamp_historyに変更履歴を保存）
    // この INSERT により trigger_update_profile_stamp_count が発火し、
    // profiles.stamp_count が MAX(stamp_number) = newStampCount に更新される
    const now = new Date();
    const manualQrCodeId = `MANUAL-ADJUST-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;

    const changeAmount = newStampCount - currentStampCount;
    const changeDescription =
      changeAmount > 0
        ? `スタッフ操作: +${changeAmount}個 (${currentStampCount} → ${newStampCount})`
        : `スタッフ操作: ${changeAmount}個 (${currentStampCount} → ${newStampCount})`;

    const { error: insertError } = await supabase.from("stamp_history").insert({
      user_id: userId,
      visit_date: now.toISOString(),
      stamp_number: newStampCount,
      stamp_method: "manual_admin",
      qr_code_id: manualQrCodeId,
      amount: changeAmount, // 変更量を記録
      notes: changeDescription,
    });

    if (insertError) {
      console.error("履歴挿入エラー:", insertError);
      return NextResponse.json(
        {
          success: false,
          message: "履歴の記録に失敗しました",
          error: insertError.message,
        },
        { status: 500 }
      );
    }

    // トリガーが発火してprofiles.stamp_countを更新するが、
    // DELETE後の状態によっては正しく計算されない可能性があるため、
    // 念のため手動でも更新する
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey) {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

      // stamp_countを強制的にnewStampCountに設定
      await supabaseAdmin
        .from("profiles")
        .update({
          stamp_count: newStampCount,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId);

      console.log(`🔧 profiles.stamp_count を ${newStampCount} に強制更新しました`);
    }

    console.log(
      `✅ スタッフによるスタンプ数変更成功: User ${userId}, ${currentStampCount} → ${newStampCount}`
    );

    return NextResponse.json(
      {
        success: true,
        message: "スタンプ数を更新しました",
        stampCount: newStampCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("手動スタンプ変更API エラー:", error);
    return NextResponse.json(
      {
        success: false,
        message: "サーバーエラーが発生しました",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
