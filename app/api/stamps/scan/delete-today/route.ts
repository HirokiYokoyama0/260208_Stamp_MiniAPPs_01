import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { logStampDeleteTodayQR } from "@/lib/analytics";

/**
 * POST /api/stamps/scan/delete-today
 * 本日のQRスタンプを削除（スタッフ用秘密機能）
 *
 * 対象：
 * - カメラ用QRコード（直接LIFF起動）
 * - アプリ内スキャン用（ペイロード型）
 * 両方とも stamp_method = "qr" で統一
 *
 * 使用用途：
 * - テスト用に本日のQRスキャンをリセット
 * - スタッフ操作（3タップ）で起動
 */

interface DeleteTodayQRRequest {
  userId: string;
}

interface DeleteTodayQRResponse {
  success: boolean;
  message: string;
  deletedCount?: number;
  error?: string;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<DeleteTodayQRResponse>> {
  try {
    const body: DeleteTodayQRRequest = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message: "ユーザーIDが不足しています",
          error: "Missing userId parameter",
        },
        { status: 400 }
      );
    }

    console.log('🗑️ [Delete Today QR] リクエスト:', { userId });

    // ユーザー情報を取得（イベントログ用）
    const { data: profileData } = await supabase
      .from("profiles")
      .select("display_name, ticket_number")
      .eq("id", userId)
      .single();

    // 今日の日付範囲を取得（JST = UTC+9 で計算、スキャンAPIと同じロジック）
    const nowJST = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    const todayJST = nowJST.toISOString().split("T")[0];
    const startOfDay = `${todayJST}T00:00:00+09:00`; // JSTの0時をISO形式で
    const endOfDay = `${todayJST}T23:59:59.999+09:00`; // JSTの23:59:59をISO形式で

    console.log(`🕐 [Delete Today QR] 日付範囲（JST基準）: ${startOfDay} ~ ${endOfDay}`);

    // 本日のQRスキャンスタンプを検索（カメラ用QR + アプリ内スキャン）
    const { data: todayScans, error: fetchError } = await supabase
      .from("stamp_history")
      .select("*")
      .eq("user_id", userId)
      .eq("stamp_method", "qr") // 全QR方式で統一（"qr_scan" → "qr"）
      .gte("visit_date", startOfDay)
      .lt("visit_date", endOfDay); // スキャンAPIと同じく .lt() を使用

    if (fetchError) {
      console.error('❌ [Delete Today QR] 検索エラー:', fetchError);
      return NextResponse.json(
        {
          success: false,
          message: "本日のスキャン履歴の取得に失敗しました",
          error: fetchError.message,
        },
        { status: 500 }
      );
    }

    if (!todayScans || todayScans.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "本日のQRスタンプ履歴がありません",
          error: "No QR stamps found today",
        },
        { status: 404 }
      );
    }

    console.log(`📋 [Delete Today QR] 本日のQRスタンプ履歴: ${todayScans.length}件`, todayScans);

    // 削除対象のスタンプ数を計算
    const totalAmount = todayScans.reduce((sum, scan) => sum + (scan.amount || 0), 0);
    const idsToDelete = todayScans.map(scan => scan.id);

    console.log(`🗑️ [Delete Today QR] 削除対象ID: ${idsToDelete.join(', ')}`);

    // stamp_historyから本日のQRスキャンを削除（通常のsupabaseクライアントを使用）
    const { error: deleteError, count } = await supabase
      .from("stamp_history")
      .delete({ count: 'exact' })
      .in("id", idsToDelete);

    console.log(`📊 [Delete Today QR] 削除クエリ結果:`, { count, error: deleteError });

    if (deleteError) {
      console.error('❌ [Delete Today QR] 削除エラー:', deleteError);
      return NextResponse.json(
        {
          success: false,
          message: "スキャン履歴の削除に失敗しました",
          error: deleteError.message,
        },
        { status: 500 }
      );
    }

    // DELETEトリガー（trigger_update_profile_on_stamp_delete）が自動的に
    // profiles.stamp_count, visit_count, last_visit_date を再計算します
    // そのため、手動でのUPDATEは不要です

    console.log(`✅ [Delete Today QR] 削除成功: ${todayScans.length}件削除, -${totalAmount}ポイント`);

    // 🔍 デバッグ: 削除後のstamp_historyを確認
    const { data: afterDelete } = await supabase
      .from("stamp_history")
      .select("*")
      .eq("user_id", userId)
      .eq("stamp_method", "qr")
      .gte("visit_date", startOfDay)
      .lt("visit_date", endOfDay);

    console.log(`🔍 [Delete Today QR] 削除後の本日QRレコード数: ${afterDelete?.length || 0}件`, afterDelete);

    // 🆕 イベントログ送信（スタッフ操作の記録）
    await logStampDeleteTodayQR({
      targetUserId: userId,
      targetUserName: profileData?.display_name,
      targetTicketNumber: profileData?.ticket_number,
      deletedCount: todayScans.length,
      deletedStamps: totalAmount,
      deletedRecords: todayScans.map(scan => ({
        id: scan.id,
        visit_date: scan.visit_date,
        stamp_number: scan.stamp_number,
        amount: scan.amount || 0,
        stamp_method: scan.stamp_method,
      })),
    });

    return NextResponse.json(
      {
        success: true,
        message: `本日のQRスタンプ ${todayScans.length}件を削除しました（-${totalAmount}ポイント）`,
        deletedCount: todayScans.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ [Delete Today QR] エラー:", error);
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
