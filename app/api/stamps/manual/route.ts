import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { AddStampResponse } from "@/types/stamp";
import { invalidateMilestoneRewards } from "@/lib/milestones";

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

    // 注: トリガーは MAX(stamp_number) を使うため、減らす操作には対応できない
    // そのため、手動変更では stamp_history への記録後に profiles.stamp_count を直接更新する

    // 監査証跡を記録（stamp_historyに変更履歴を保存）
    const now = new Date();
    const manualQrCodeId = `MANUAL-ADJUST-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;

    const changeAmount = newStampCount - currentStampCount;
    const changeDescription =
      changeAmount > 0
        ? `スタッフ操作: +${changeAmount}個 (${currentStampCount} → ${newStampCount})`
        : `スタッフ操作: ${changeAmount}個 (${currentStampCount} → ${newStampCount})`;

    // スタッフ操作を「起点」として扱う: 古い履歴を全削除
    // 理由: トリガーはMAX(stamp_number)を計算するため、古いレコードが残ると
    //       次回のQRスキャン時に誤った値が計算される
    // 注: RLSポリシー (027_allow_delete_non_admin_stamps.sql) により、
    //     ANON_KEYでも全レコード削除可能（Service Role Key不要）
    const { error: deleteError } = await supabase
      .from("stamp_history")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.error("❌ 古い履歴削除エラー:", deleteError);
      return NextResponse.json(
        {
          success: false,
          message: "古い履歴の削除に失敗しました",
          error: deleteError.message,
        },
        { status: 500 }
      );
    }

    console.log(`🗑️ スタッフ操作を起点として設定: User ${userId} の古い履歴を削除`);

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

    // profiles.stamp_count を直接更新する（トリガーは MAX を使うため減らす操作に対応できない）
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        stamp_count: newStampCount,
        updated_at: now.toISOString()
      })
      .eq("id", userId);

    if (updateError) {
      console.error("プロフィール更新エラー:", updateError);
      return NextResponse.json(
        {
          success: false,
          message: "スタンプ数の更新に失敗しました",
          error: updateError.message,
        },
        { status: 500 }
      );
    }

    console.log(`✅ profiles.stamp_count を ${currentStampCount} → ${newStampCount} に更新しました`);

    // マイルストーン特典の無効化処理（スタンプ減少時のみ）
    console.log(`🔍 [manual/route] changeAmount確認: ${changeAmount}, 条件: ${changeAmount < 0}`);

    if (changeAmount < 0) {
      console.log(`🔄 [manual/route] スタンプ減少を検出: ${currentStampCount} → ${newStampCount}`);

      try {
        const invalidatedCount = await invalidateMilestoneRewards(
          userId,
          currentStampCount,
          newStampCount
        );

        if (invalidatedCount > 0) {
          console.log(
            `✅ [manual/route] マイルストーン特典を無効化: User ${userId}, ${invalidatedCount}件の特典を cancelled に変更`
          );
        } else {
          console.log(
            `ℹ️ [manual/route] 無効化する特典なし: User ${userId}, スタンプ減少 (${currentStampCount} → ${newStampCount})`
          );
        }
      } catch (error) {
        console.error(`❌ [manual/route] マイルストーン特典無効化エラー:`, error);
        // エラーでもスタンプ数変更は完了しているので、警告のみ
        // 管理ダッシュボードで手動確認が必要
      }
    } else {
      console.log(`⏭️ [manual/route] スタンプ減少なし (changeAmount: ${changeAmount})、マイルストーン無効化スキップ`);
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
