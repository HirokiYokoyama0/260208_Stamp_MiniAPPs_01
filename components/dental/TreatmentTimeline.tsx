'use client';

import React from 'react';
import { HistoryRecord } from '@/types/dental-record';
import { formatRecordDate, getRelativeTime } from '@/lib/dental-records';

type TreatmentTimelineProps = {
  records: HistoryRecord[];
};

export default function TreatmentTimeline({ records }: TreatmentTimelineProps) {
  if (!records || records.length === 0) {
    return (
      <div className="mt-4 p-6 text-center bg-white rounded-xl">
        <p className="text-gray-400 text-sm">まだ治療記録がありません</p>
        <p className="text-gray-300 text-xs mt-1">次回の診療後に記録が表示されます</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <h2 className="text-sm font-bold text-gray-700 px-1">治療履歴</h2>

      {records.map((record) => (
        <div key={record.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          {/* 日付とスタッフ */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">📅</span>
              <div>
                <span className="font-semibold text-sm text-gray-900">
                  {formatRecordDate(record.recorded_at)}
                </span>
                <span className="text-xs text-gray-400 ml-2">
                  {getRelativeTime(record.recorded_at)}
                </span>
              </div>
            </div>
          </div>

          {/* スタッフ名 */}
          <div className="text-xs text-gray-500 mb-3">
            担当: {record.staff_display_name}
          </div>

          {/* 治療内容 */}
          <ul className="space-y-1.5 mb-3">
            {record.changes.map((change, idx) => (
              <li key={idx} className="text-sm text-gray-700 flex items-start">
                <span className="text-blue-500 mr-1.5 mt-0.5">•</span>
                <div>
                  <span className="font-medium">{change.tooth_name}</span>
                  <span className="text-gray-500 text-xs ml-1">
                    ({change.tooth_number})
                  </span>
                  <span className="mx-1.5">-</span>
                  <span className="text-gray-600">{change.status_label}</span>
                </div>
              </li>
            ))}
          </ul>

          {/* 次回予定メモ */}
          {record.next_visit_memo && (
            <div className="text-xs bg-blue-50 p-2.5 rounded-lg border-l-3 border-blue-400 mt-3">
              <span className="font-semibold text-blue-900">次回:</span>
              <span className="text-blue-700 ml-1">{record.next_visit_memo}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
