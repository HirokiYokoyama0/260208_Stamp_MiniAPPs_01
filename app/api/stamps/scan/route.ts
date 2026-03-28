import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { logStampScanSuccess, logStampScanFail } from "@/lib/analytics";
import { checkMilestones, grantMilestoneReward } from "@/lib/milestones";

/**
 * QRコードスキャンによるスタンプ付与API
 *
 * エンドポイント: POST /api/stamps/scan
 *
 * 仕様: Doc/24_QRコード表示_LIFFアプリ開発者へ.md
 *
 * QRコードペイロード形式:
 * - 優良患者様用: {"type":"premium","stamps":15}
 * - 通常患者様用: {"type":"regular","stamps":10}
 * - 購買インセンティブ用: {"type":"purchase","stamps":5}
 */

interface QRScanRequest {
  userId: string;                              // LINEユーザーID (必須)
  type: "premium" | "regular" | "purchase";    // QRコードタイプ (必須)
  stamps: number;                              // 付与スタンプ個数 (必須)
  qrCodeId?: string;                           // QRコードID (重複防止用、オプション)
}

interface QRScanResponse {
  success: boolean;
  message: string;
  stampCount?: number;      // 付与後の合計スタンプ数
  stampsAdded?: number;     // 今回付与したスタンプ個数
  error?: string;
}

/**
 * POST /api/stamps/scan
 * QRコードスキャンでスタンプを付与
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<QRScanResponse>> {
  try {
    const body: QRScanRequest = await request.json();
    const { userId, type, stamps, qrCodeId } = body;

    // デバッグログ：受信したペイロードを記録
    console.log('🔍 [QR Scan API] 受信したリクエスト:', {
      userId,
      type,
      stamps,
      qrCodeId,
    });

    // バリデーション
    if (!userId || !type || stamps === undefined) {
      return NextResponse.json(
        {
          success: false,
          message: "必須パラメータが不足しています",
          error: "Missing required fields: userId, type, stamps",
        },
        { status: 400 }
      );
    }

    // タイプのバリデーション
    if (type !== "premium" && type !== "regular" && type !== "purchase") {
      return NextResponse.json(
        {
          success: false,
          message: "無効なQRコードタイプです",
          error: `Invalid type: ${type}. Must be 'premium', 'regular', or 'purchase'`,
        },
        { status: 400 }
      );
    }

    // スタンプ個数のバリデーション
    if (stamps <= 0 || !Number.isInteger(stamps)) {
      return NextResponse.json(
        {
          success: false,
          message: "無効なスタンプ個数です",
          error: `Invalid stamps: ${stamps}. Must be a positive integer`,
        },
        { status: 400 }
      );
    }

    // ユーザー存在チェック
    const { data: profileData, error: fetchError } = await supabase
      .from("profiles")
      .select("id, stamp_count, display_name")
      .eq("id", userId)
      .single();

    if (fetchError || !profileData) {
      console.error("ユーザープロフィール取得エラー:", fetchError);
      return NextResponse.json(
        {
          success: false,
          message: "ユーザーが見つかりません",
          error: fetchError?.message || "User not found",
        },
        { status: 404 }
      );
    }

    // 1日1回制限チェック（購買インセンティブは対象外）
    // カメラ用QRコード（直接LIFF起動）とアプリ内スキャン用（ペイロード型）の両方を含む
    if (type !== "purchase") {
      // 日本時間（JST = UTC+9）で当日の範囲を計算
      const nowJST = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
      const todayJST = nowJST.toISOString().split("T")[0];
      const startOfDayUTC = `${todayJST}T00:00:00+09:00`; // JSTの0時をISO形式で
      const endOfDayUTC = `${todayJST}T23:59:59.999+09:00`; // JSTの23:59:59をISO形式で

      const { data: todayQrRecords, error: qrCheckError } = await supabase
        .from("stamp_history")
        .select("id, stamp_method, notes")
        .eq("user_id", userId)
        .eq("stamp_method", "qr")
        .gte("visit_date", startOfDayUTC)
        .lt("visit_date", endOfDayUTC);

      if (qrCheckError) {
        console.error("❌ 1日1回制限チェックエラー:", qrCheckError);
        return NextResponse.json(
          {
            success: false,
            message: "チェックに失敗しました",
            error: qrCheckError.message,
          },
          { status: 500 }
        );
      }

      if (todayQrRecords && todayQrRecords.length > 0) {
        console.log(`⚠️ 1日1回制限: User ${userId} は本日既にQRスタンプを取得済み`);
        await logStampScanFail({
          error: "Already received QR stamp today",
          userId: userId,
          errorType: "duplicate_scan",
          httpStatus: 409,
          requestType: type,
          requestStamps: stamps,
        });
        return NextResponse.json(
          {
            success: false,
            message: "本日は既にQRコードでスタンプを受け取っています",
            error: "Already received QR stamp today",
          },
          { status: 409 } // 409 Conflict
        );
      }
    }

    const currentStampCount = profileData.stamp_count ?? 0;
    const nextStampNumber = currentStampCount + stamps;

    // stamp_historyに新規レコードを挿入
    const { data: stampData, error: insertError } = await supabase
      .from("stamp_history")
      .insert({
        user_id: userId,
        visit_date: new Date().toISOString(),
        stamp_number: nextStampNumber,
        stamp_method: type === "purchase" ? "purchase_incentive" : "qr", // 購買インセンティブのみ別メソッド
        qr_code_id: qrCodeId || `${type}_${Date.now()}`, // qrCodeIdがない場合は生成
        amount: stamps, // 今回付与したスタンプ個数
        notes: type === "purchase"
          ? "購買インセンティブ (アプリ内スキャン)"
          : `アプリ内スキャン (${type})`, // ペイロード型であることを記録
      })
      .select()
      .single();

    if (insertError) {
      console.error("スタンプ登録エラー:", insertError);
      return NextResponse.json(
        {
          success: false,
          message: "スタンプの登録に失敗しました",
          error: insertError.message,
        },
        { status: 500 }
      );
    }

    // トリガーでprofilesが自動更新されるため、更新後のstamp_countを取得
    const { data: updatedProfile } = await supabase
      .from("profiles")
      .select("stamp_count")
      .eq("id", userId)
      .single();

    const finalStampCount = updatedProfile?.stamp_count ?? nextStampNumber;

    console.log(
      `✅ QRスキャンスタンプ登録成功: User ${userId} (${profileData.display_name}), Type: ${type}, Stamps: +${stamps}個, Total: ${finalStampCount}個`
    );

    // マイルストーン判定と特典自動付与
    const milestones = checkMilestones(currentStampCount, finalStampCount);
    const grantedRewards = [];

    for (const { milestone, rewardType } of milestones) {
      try {
        const exchange = await grantMilestoneReward(userId, milestone, rewardType);
        grantedRewards.push({
          milestone,
          rewardType,
          exchangeId: exchange.id
        });
        console.log(`🎁 マイルストーン特典付与: User ${userId}, ${milestone}スタンプ, ${rewardType}`);
      } catch (error) {
        console.error(`❌ マイルストーン特典付与エラー:`, error);
        // エラーでもスタンプ付与自体は成功しているので処理続行
      }
    }

    // イベントログ記録（詳細情報追加）
    try {
      console.log('🔍 [API] スタンプスキャン成功ログを送信:', {
        stampsAdded: stamps,
        type: type,
        userId: userId.substring(0, 8) + '...',
        currentStampCount,
        newStampCount: finalStampCount,
      });

      const logResult = await logStampScanSuccess({
        stampsAdded: stamps,
        type: type,
        userId: userId,
        currentStampCount: currentStampCount,
        newStampCount: finalStampCount,
        stampHistoryId: stampData?.id,
        milestonesGranted: grantedRewards,
      });

      if (!logResult.success) {
        console.error('⚠️ [API] イベントログ記録失敗（スタンプ付与は成功）:', logResult.error);
      }
    } catch (logError) {
      // イベントログ失敗してもスタンプ付与は成功しているので処理続行
      console.error('❌ [API] イベントログ記録エラー（スタンプ付与は成功）:', logError);
    }

    return NextResponse.json(
      {
        success: true,
        message: `${stamps}個のスタンプを獲得しました！`,
        stampCount: finalStampCount,
        stampsAdded: stamps,
        milestones: grantedRewards.length > 0 ? grantedRewards : undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("QRスキャンスタンプ登録API エラー:", error);
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
