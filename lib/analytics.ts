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
      console.error('❌ Analytics error:', error);
      return { success: false, error: error.message };
    }

    // 開発環境ではコンソールにログ出力
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 [Analytics]', {
        event: eventName,
        source: detectedSource,
        user: targetUserId?.substring(0, 8) + '...',
        metadata: enrichedMetadata,
      });
    }

    return { success: true };
  } catch (error) {
    // ログ送信失敗してもユーザー体験を妨げない
    console.error('⚠️ Analytics error:', error);
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
 * スタンプスキャン成功ログ
 */
export const logStampScanSuccess = (params: { stampsAdded: number; type: 'regular' | 'premium'; userId?: string }) => {
  return logEvent({
    eventName: 'stamp_scan_success',
    userId: params.userId,
    metadata: { stamps_added: params.stampsAdded, type: params.type },
  });
};

/**
 * スタンプスキャン失敗ログ
 */
export const logStampScanFail = (params: { error: string; userId?: string }) => {
  return logEvent({
    eventName: 'stamp_scan_fail',
    userId: params.userId,
    metadata: { error: params.error },
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
