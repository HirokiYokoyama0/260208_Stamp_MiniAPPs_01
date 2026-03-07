/**
 * ケア記録機能のユーティリティ関数とSWRフック
 * 参考: Doc_miniApps/54_ケア記録機能_LIFF開発者向け.md
 */

import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import { DentalRecord, HistoryRecord, HistoryChange } from '@/types/dental-record';
import { getToothName } from '@/lib/dental-tooth-names';

/**
 * 最新のケア記録を取得するSWRフック
 */
export function useLatestRecord(userId: string | undefined) {
  return useSWR<DentalRecord | null>(
    userId ? ['latest-dental-record', userId] : null,
    async () => {
      const { data, error } = await supabase.rpc('get_latest_dental_record', {
        p_patient_id: userId!
      });

      if (error) {
        console.error('❌ 最新ケア記録の取得エラー:', error);
        throw error;
      }

      // RPC関数は配列を返すので、最初の要素を取得
      if (!data || !Array.isArray(data) || data.length === 0) {
        return null;
      }

      return data[0] as DentalRecord;
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1分間キャッシュ
    }
  );
}

/**
 * ケア記録の履歴を取得するSWRフック
 */
export function useHistoryRecords(userId: string | undefined, limit: number = 20) {
  return useSWR<HistoryRecord[]>(
    userId ? ['dental-record-history', userId, limit] : null,
    async () => {
      const { data, error } = await supabase.rpc('get_dental_record_history', {
        p_patient_id: userId!,
        p_limit: limit,
        p_offset: 0
      });

      if (error) {
        console.error('❌ ケア記録履歴の取得エラー:', error);
        throw error;
      }

      if (!data) return [];

      // tooth_data から変更箇所を抽出してタイムライン用に加工
      return (data as DentalRecord[]).map(record => ({
        id: record.id,
        recorded_at: record.recorded_at,
        staff_display_name: record.staff_display_name || 'スタッフ',
        next_visit_memo: record.next_visit_memo ?? null,
        changes: extractChanges(record.tooth_data)
      }));
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );
}

/**
 * 特定の歯の詳細履歴を取得するSWRフック（オプション）
 */
export function useToothHistory(userId: string | undefined, toothNumber: string | null) {
  return useSWR<any[]>(
    userId && toothNumber ? ['tooth-detail-history', userId, toothNumber] : null,
    async () => {
      const { data, error } = await supabase.rpc('get_tooth_detail_history', {
        p_patient_id: userId!,
        p_tooth_number: toothNumber!
      });

      if (error) {
        console.error('❌ 歯の詳細履歴の取得エラー:', error);
        throw error;
      }

      return data || [];
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );
}

/**
 * tooth_data から変更箇所を抽出（タイムライン表示用）
 */
function extractChanges(toothData: { [key: string]: any }): HistoryChange[] {
  if (!toothData || typeof toothData !== 'object') {
    return [];
  }

  return Object.entries(toothData).map(([toothNumber, data]) => ({
    tooth_number: toothNumber,
    tooth_name: getToothName(toothNumber),
    status_label: data?.status_label || '不明'
  }));
}

/**
 * 日付を日本語形式にフォーマット
 */
export function formatRecordDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });
  } catch {
    return isoDate;
  }
}

/**
 * 相対時間を取得（例: "3日前", "2週間前"）
 */
export function getRelativeTime(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今日';
    if (diffDays === 1) return '昨日';
    if (diffDays < 7) return `${diffDays}日前`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks}週間前`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months}ヶ月前`;
    }
    const years = Math.floor(diffDays / 365);
    return `${years}年前`;
  } catch {
    return '';
  }
}
