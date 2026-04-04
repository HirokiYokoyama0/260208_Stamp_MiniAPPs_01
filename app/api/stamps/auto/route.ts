import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkMilestones, grantMilestoneReward } from "@/lib/milestones";
import { logStampScanSuccess, logStampScanFail } from "@/lib/analytics";

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

    if (type !== "qr" && type !== "purchase") {
      return NextResponse.json(
        { success: false, message: "無効なスタンプタイプです" },
        { status: 400 }
      );
    }

    if (![5, 10, 15].includes(amount)) {
      return NextResponse.json(
        { success: false, message: "スタンプ数は5、10、または15である必要があります" },
        { status: 400 }
      );
    }

    // 1日1回制限チェック（購買インセンティブは対象外）
    // カメラ用QRコード（直接LIFF起動）とアプリ内スキャン用（ペイロード型）の両方を含む
    if (location !== "shop") {
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
          { success: false, message: "チェックに失敗しました" },
          { status: 500 }
        );
      }

      if (todayQrRecords && todayQrRecords.length > 0) {
        console.log(`⚠️ 1日1回制限: User ${userId} は本日既にQRスタンプを取得済み`);

        // イベントログ記録（失敗: 重複スキャン）
        try {
          const stampType = location === "shop" ? "purchase" :
                           amount === 15 ? "premium" : "regular";
          await logStampScanFail({
            error: "Already received QR stamp today",
            userId: userId,
            errorType: "duplicate_scan",
            httpStatus: 409,
            requestType: stampType,
            requestStamps: amount,
          });
        } catch (logError) {
          console.error('❌ [API/Auto] イベントログ記録エラー:', logError);
        }

        return NextResponse.json(
          {
            success: false,
            message: "本日は既にQRコードでスタンプを受け取っています",
            alreadyReceived: true
          },
          { status: 409 } // 409 Conflict
        );
      }
    }

    // 現在のスタンプ数と家族情報を取得
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stamp_count, family_id")
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

    // 家族スタンプ合算値を取得（マイルストーン判定用）
    let effectiveStampCountOld = currentStampCount;
    let effectiveStampCountNew = newStampNumber;

    if (profile.family_id) {
      const { data: familyTotal } = await supabase
        .from("family_stamp_totals")
        .select("total_stamp_count, member_count")
        .eq("family_id", profile.family_id)
        .single();

      // 2人以上の家族の場合は家族合算値を使用
      if (familyTotal && familyTotal.member_count >= 2) {
        const oldFamilyTotal = familyTotal.total_stamp_count - amount; // 付与前の家族合算
        effectiveStampCountOld = oldFamilyTotal;
        effectiveStampCountNew = familyTotal.total_stamp_count; // 付与後の家族合算

        console.log(`👨‍👩‍👧 家族スタンプ合算でマイルストーン判定: ${oldFamilyTotal} → ${familyTotal.total_stamp_count}`);
      }
    }

    // stamp_historyに記録を追加
    const { data: historyData, error: historyError } = await supabase
      .from("stamp_history")
      .insert({
        user_id: userId,
        stamp_method: location === "shop" ? "purchase_incentive" : "qr", // 購買インセンティブのみ別メソッド
        amount: amount,
        stamp_number: newStampNumber,
        visit_date: new Date().toISOString(),
        notes: location === "shop"
          ? "購買インセンティブ (カメラ用QR)"
          : (location ? `カメラ用QR (${location})` : "カメラ用QR"),
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

    // マイルストーン判定と特典自動付与（重複チェック付き、家族スタンプ合算対応）
    const milestones = await checkMilestones(userId, effectiveStampCountOld, effectiveStampCountNew);
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
      // スタンプタイプを正しく判定
      const stampType = location === "shop" ? "purchase" :
                       amount === 15 ? "premium" : "regular";

      console.log('🔍 [API/Auto] スタンプスキャン成功ログを送信:', {
        stampsAdded: amount,
        type: stampType,
        userId: userId.substring(0, 8) + '...',
        currentStampCount,
        newStampCount: newStampNumber,
      });

      const logResult = await logStampScanSuccess({
        stampsAdded: amount,
        type: stampType,
        userId: userId,
        scanMethod: 'camera',  // カメラ用QR直接起動
        currentStampCount: currentStampCount,
        newStampCount: newStampNumber,
        stampHistoryId: historyData?.id,
        milestonesGranted: grantedRewards,
        // 🆕 リクエスト生パラメータを記録（15スタンプ問題調査用）
        requestAmount: amount,
        requestLocation: location,
        requestType: type,
      });

      if (!logResult.success) {
        console.error('⚠️ [API/Auto] イベントログ記録失敗（スタンプ付与は成功）:', logResult.error);
      }
    } catch (logError) {
      // イベントログ失敗してもスタンプ付与は成功しているので処理続行
      console.error('❌ [API/Auto] イベントログ記録エラー（スタンプ付与は成功）:', logError);
    }

    return NextResponse.json({
      success: true,
      stampCount: newStampNumber,
      addedAmount: amount,
      message: `スタンプを${amount}個獲得しました！`,
      milestones: grantedRewards.length > 0 ? grantedRewards : undefined,
    });

  } catch (error) {
    console.error("❌ QRスタンプ自動付与エラー:", error);
    return NextResponse.json(
      { success: false, message: "エラーが発生しました" },
      { status: 500 }
    );
  }
}
