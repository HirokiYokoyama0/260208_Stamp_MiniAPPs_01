import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * DELETE /api/stamps/scan/delete-today
 * 本日のQRスキャンスタンプを削除（スタッフ用秘密機能）
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

    // 今日の日付範囲を取得（UTCタイムゾーンで指定）
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const startOfDay = `${today}T00:00:00.000Z`;  // Zを追加してUTCを明示
    const endOfDay = `${today}T23:59:59.999Z`;    // Zを追加してUTCを明示

    console.log(`🕐 [Delete Today QR] 日付範囲: ${startOfDay} ~ ${endOfDay}`);

    // 本日のQRスキャンスタンプを検索
    const { data: todayScans, error: fetchError } = await supabase
      .from("stamp_history")
      .select("*")
      .eq("user_id", userId)
      .eq("stamp_method", "qr_scan")
      .gte("visit_date", startOfDay)
      .lte("visit_date", endOfDay);

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
          message: "本日のQRスキャン履歴がありません",
          error: "No QR scans found today",
        },
        { status: 404 }
      );
    }

    console.log(`📋 [Delete Today QR] 本日のスキャン履歴: ${todayScans.length}件`, todayScans);

    // 削除対象のスタンプ数を計算
    const totalAmount = todayScans.reduce((sum, scan) => sum + (scan.amount || 0), 0);
    const idsToDelete = todayScans.map(scan => scan.id);

    console.log(`🗑️ [Delete Today QR] 削除対象ID: ${idsToDelete.join(', ')}`);

    // stamp_historyから本日のQRスキャンを削除（IDで直接指定）
    // 削除時のトリガーで profiles.stamp_count が自動更新される
    const { data: deleteResult, error: deleteError, count } = await supabase
      .from("stamp_history")
      .delete()
      .in("id", idsToDelete)
      .select();

    console.log(`📊 [Delete Today QR] 削除クエリ結果:`, { deleteResult, count, error: deleteError });

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

    // profiles.stamp_countはトリガーで自動更新されるため、再取得して確認
    const { data: updatedProfile } = await supabase
      .from("profiles")
      .select("stamp_count")
      .eq("id", userId)
      .single();

    const newStampCount = updatedProfile?.stamp_count || 0;

    console.log(`✅ [Delete Today QR] 削除成功: ${todayScans.length}件削除, -${totalAmount}ポイント, 新しい合計: ${newStampCount}`);

    return NextResponse.json(
      {
        success: true,
        message: `本日のQRスキャン ${todayScans.length}件を削除しました（-${totalAmount}ポイント）`,
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
