// lib/analytics.ts
// ユーザー行動ログ送信ユーティリティ
// イベントログをSupabaseに記録してマーケティング分析・効果測定に活用

import { supabase } from './supabase';

// =====================================
// 型定義
// =====================================

/**
 * イベントログのパラメータ
 */
export interface LogEventParams {
  /** イベント名（例: 'app_open', 'stamp_scan_success'） */
  eventName: string;
  /** 流入元（例: 'line_msg_0223', 'direct'） */
  source?: string;
  /** 追加のメタデータ（JSON形式） */
  metadata?: Record<string, any>;
  /** ユーザーID（省略時は自動検出） */
  userId?: string;
}

/**
 * イベントログのレスポンス
 */
interface LogEventResponse {
  success: boolean;
  error?: string;
}

// =====================================
// メイン関数: イベントログ送信
// =====================================

/**
 * イベントログをSupabaseに送信
 *
 * @example
 * // 基本的な使い方
 * logEvent({ eventName: 'app_open' });
 *
 * @example
 * // メタデータ付き
 * logEvent({
 *   eventName: 'stamp_scan_success',
 *   metadata: { stamps_added: 5, type: 'regular' }
 * });
 *
 * @example
 * // 流入元指定
 * logEvent({
 *   eventName: 'app_open',
 *   source: 'line_msg_0223'
 * });
 */
export const logEvent = async (params: LogEventParams): Promise<LogEventResponse> => {
  try {
    const { eventName, source, metadata, userId } = params;

    // URLパラメータから流入元を自動検出
    let detectedSource = source;
    if (typeof window !== 'undefined' && !detectedSource) {
      const urlParams = new URLSearchParams(window.location.search);
      detectedSource = urlParams.get('from') || urlParams.get('source') || 'direct';
    }

    // ユーザーエージェント等の基本情報を自動追加
    const enrichedMetadata = typeof window !== 'undefined' ? {
      ...metadata,
      user_agent: navigator.userAgent,
      screen_size: `${window.screen.width}x${window.screen.height}`,
      viewport_size: `${window.innerWidth}x${window.innerHeight}`,
      referrer: document.referrer || null,
      page_path: window.location.pathname,
      timestamp: new Date().toISOString(),
    } : metadata;

    // ユーザーIDの取得
    // 注意: userIdはlogEvent呼び出し時に明示的に渡すことを推奨
    // 各コンポーネントでuseLiff()のprofileからuserIdを取得して渡してください
    let targetUserId = userId;

    // Supabaseにログを送信
    const { error } = await supabase.from('event_logs').insert({
      user_id: targetUserId || null,
      event_name: eventName,
      source: detectedSource,
      metadata: enrichedMetadata,
    });

    if (error) {
      // エラーの詳細情報を記録（サーバーサイドではVercelログに記録される）
      console.error('❌ [Analytics] Event log insertion failed:', {
        eventName,
        userId: targetUserId?.substring(0, 8) + '...',
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return { success: false, error: error.message };
    }

    // 成功時も明示的にログ出力（デバッグ用）
    console.log('✅ [Analytics] Event log inserted:', {
      eventName,
      userId: targetUserId?.substring(0, 8) + '...',
      hasMetadata: !!enrichedMetadata,
      metadataKeys: enrichedMetadata ? Object.keys(enrichedMetadata) : [],
    });

    return { success: true };
  } catch (error) {
    // ログ送信失敗してもユーザー体験を妨げない
    console.error('⚠️ [Analytics] Unexpected error:', {
      eventName: params.eventName,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { success: false, error: String(error) };
  }
};

// =====================================
// 便利関数: よく使うイベント
// =====================================

/**
 * アプリ起動ログ
 */
export const logAppOpen = (params?: { userId?: string; metadata?: Record<string, any> }) => {
  return logEvent({
    eventName: 'app_open',
    userId: params?.userId,
    metadata: params?.metadata,
  });
};

/**
 * ページ閲覧ログ
 */
export const logPageView = (params: { pagePath: string; userId?: string; metadata?: Record<string, any> }) => {
  return logEvent({
    eventName: 'page_view',
    userId: params.userId,
    metadata: { ...params.metadata, page_path: params.pagePath },
  });
};

/**
 * QRスキャン開始ログ（デバイス情報付き）
 */
export const logStampScanStart = (params: {
  userId?: string;
  deviceType?: 'iPhone' | 'Android' | 'Unknown';
  metadata?: Record<string, any>;
}) => {
  return logEvent({
    eventName: 'stamp_scan_start',
    userId: params.userId,
    metadata: {
      ...params.metadata,
      device_type: params.deviceType,
      liff_version: typeof window !== 'undefined' && (window as any).liff ? (window as any).liff.getVersion() : null,
    },
  });
};

/**
 * QRスキャンAPIリクエストログ（QR生値とパース後の値を記録）
 */
export const logStampScanApiRequest = (params: {
  userId?: string;
  qrRawValue: string;
  qrParsed: { type: string; stamps: number };
  requestPayload: Record<string, any>;
}) => {
  return logEvent({
    eventName: 'stamp_scan_api_request',
    userId: params.userId,
    metadata: {
      qr_raw_value: params.qrRawValue,
      qr_parsed: params.qrParsed,
      request_payload: params.requestPayload,
    },
  });
};

/**
 * スタンプスキャン成功ログ（詳細情報追加）
 *
 * @param scanMethod - 'camera': カメラ用QR直接起動, 'in_app': ミニアプリ内スキャンボタン
 */
export const logStampScanSuccess = (params: {
  stampsAdded: number;
  type: 'regular' | 'premium' | 'purchase';
  userId?: string;
  scanMethod?: 'camera' | 'in_app';  // スキャン方法を追加
  // 以下、追加パラメータ（不具合調査用）
  currentStampCount?: number;
  newStampCount?: number;
  stampHistoryId?: string;
  milestonesGranted?: Array<{ milestone: number; rewardType: string; exchangeId: string }>;
  // 🆕 リクエスト生パラメータ（15スタンプ問題調査用）
  requestAmount?: number;        // APIリクエストで受け取ったamount/stamps
  requestLocation?: string;      // APIリクエストで受け取ったlocation（カメラQRのみ）
  requestType?: string;          // APIリクエストで受け取ったtype
}) => {
  // スキャン方法に応じてイベント名を分ける
  const eventName = params.scanMethod === 'in_app'
    ? 'stamp_scan_success_in_app'  // ミニアプリ内スキャン
    : 'stamp_scan_success';         // カメラQR直接起動

  return logEvent({
    eventName,
    userId: params.userId,
    metadata: {
      stamps_added: params.stampsAdded,
      type: params.type,
      scan_method: params.scanMethod || 'camera',  // デフォルトはカメラ
      current_stamp_count: params.currentStampCount,
      new_stamp_count: params.newStampCount,
      stamp_history_id: params.stampHistoryId,
      milestones_granted: params.milestonesGranted,
      // 🆕 リクエスト生パラメータを記録
      request_amount: params.requestAmount,
      request_location: params.requestLocation,
      request_type: params.requestType,
    },
  });
};

/**
 * スタンプスキャン失敗ログ（詳細情報追加）
 */
export const logStampScanFail = (params: {
  error: string;
  userId?: string;
  // 以下、追加パラメータ（不具合調査用）
  errorType?: string;
  httpStatus?: number;
  requestType?: string;
  requestStamps?: number;
}) => {
  return logEvent({
    eventName: 'stamp_scan_fail',
    userId: params.userId,
    metadata: {
      error: params.error,
      error_type: params.errorType,
      http_status: params.httpStatus,
      request_type: params.requestType,
      request_stamps: params.requestStamps,
    },
  });
};

/**
 * 本日のQRスキャン削除ログ（スタッフ操作）
 */
export const logStampDeleteTodayQR = (params: {
  userId?: string;  // 操作したユーザー（通常は対象ユーザーと同じ）
  targetUserId: string;
  targetUserName?: string;
  targetTicketNumber?: string;
  deletedCount: number;
  deletedStamps: number;
  deletedRecords?: Array<{
    id: string;
    visit_date: string;
    stamp_number: number;
    amount: number;
    stamp_method: string;
  }>;
}) => {
  return logEvent({
    eventName: 'stamp_delete_today_qr',
    userId: params.userId || params.targetUserId,
    metadata: {
      target_user_id: params.targetUserId,
      target_user_name: params.targetUserName,
      target_ticket_number: params.targetTicketNumber,
      deleted_count: params.deletedCount,
      deleted_stamps: params.deletedStamps,
      deleted_records: params.deletedRecords,
      staff_initiated: true,
    },
  });
};

/**
 * 予約ボタンクリックログ
 */
export const logReservationClick = (params: { fromPage: string; currentStampCount?: number; userId?: string }) => {
  return logEvent({
    eventName: 'reservation_button_click',
    userId: params.userId,
    metadata: { from_page: params.fromPage, current_stamp_count: params.currentStampCount },
  });
};

/**
 * 特典交換成功ログ
 */
export const logRewardExchange = (params: { rewardId: number; rewardName: string; stampsUsed: number; userId?: string }) => {
  return logEvent({
    eventName: 'reward_exchange_success',
    userId: params.userId,
    metadata: { reward_id: params.rewardId, reward_name: params.rewardName, stamps_used: params.stampsUsed },
  });
};

/**
 * スロットゲームプレイログ
 */
export const logSlotGamePlay = (params: { result: 'win' | 'lose'; stampsWon: number; userId?: string }) => {
  return logEvent({
    eventName: 'slot_game_play',
    userId: params.userId,
    metadata: { result: params.result, stamps_won: params.stampsWon },
  });
};

/**
 * エラー発生ログ
 */
export const logError = (params: { errorType: string; errorMessage: string; userId?: string; metadata?: Record<string, any> }) => {
  return logEvent({
    eventName: 'error_occurred',
    userId: params.userId,
    metadata: { ...params.metadata, error_type: params.errorType, message: params.errorMessage },
  });
};

// =====================================
// 家族管理・子供画面関連のイベント
// =====================================

/**
 * 家族管理画面を開いたログ
 */
export const logFamilyManageOpen = (params: { userId?: string; familyId?: string }) => {
  return logEvent({
    eventName: 'family_manage_open',
    userId: params.userId,
    metadata: { family_id: params.familyId },
  });
};

/**
 * 家族メンバー追加ログ
 */
export const logFamilyMemberAdd = (params: { userId?: string; familyId?: string; memberName: string; memberType: 'parent' | 'child' }) => {
  return logEvent({
    eventName: 'family_member_add',
    userId: params.userId,
    metadata: {
      family_id: params.familyId,
      member_name: params.memberName,
      member_type: params.memberType,
    },
  });
};

/**
 * 家族メンバー編集ログ
 */
export const logFamilyMemberEdit = (params: { userId?: string; familyId?: string; memberId: string; memberName: string }) => {
  return logEvent({
    eventName: 'family_member_edit',
    userId: params.userId,
    metadata: {
      family_id: params.familyId,
      member_id: params.memberId,
      member_name: params.memberName,
    },
  });
};

/**
 * 家族メンバー削除ログ
 */
export const logFamilyMemberDelete = (params: { userId?: string; familyId?: string; memberId: string; memberName: string }) => {
  return logEvent({
    eventName: 'family_member_delete',
    userId: params.userId,
    metadata: {
      family_id: params.familyId,
      member_id: params.memberId,
      member_name: params.memberName,
    },
  });
};

/**
 * 子供モード開始ログ
 */
export const logChildModeEnter = (params: { userId?: string; childId: string; childName: string }) => {
  return logEvent({
    eventName: 'child_mode_enter',
    userId: params.userId,
    metadata: {
      child_id: params.childId,
      child_name: params.childName,
    },
  });
};

/**
 * 子供モード終了ログ
 */
export const logChildModeExit = (params: { userId?: string; childId: string; childName: string; durationSeconds?: number }) => {
  return logEvent({
    eventName: 'child_mode_exit',
    userId: params.userId,
    metadata: {
      child_id: params.childId,
      child_name: params.childName,
      duration_seconds: params.durationSeconds,
    },
  });
};

/**
 * 子供画面でのページ閲覧ログ
 */
export const logChildScreenView = (params: { userId?: string; childId: string; childName: string; pagePath: string }) => {
  return logEvent({
    eventName: 'child_screen_view',
    userId: params.userId,
    metadata: {
      child_id: params.childId,
      child_name: params.childName,
      page_path: params.pagePath,
    },
  });
};

// =====================================
// セッション管理（オプション）
// =====================================

let sessionId: string | null = null;
let sessionStartTime: number | null = null;

/**
 * セッション開始
 */
export const startSession = () => {
  if (typeof window === 'undefined') return;

  sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  sessionStartTime = Date.now();

  logEvent({
    eventName: 'session_start',
    metadata: { session_id: sessionId },
  });
};

/**
 * セッション終了
 */
export const endSession = () => {
  if (typeof window === 'undefined' || !sessionId || !sessionStartTime) return;

  const durationSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);

  logEvent({
    eventName: 'session_end',
    metadata: { session_id: sessionId, duration_seconds: durationSeconds },
  });

  sessionId = null;
  sessionStartTime = null;
};

// ページアンロード時にセッション終了
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    endSession();
  });
}
