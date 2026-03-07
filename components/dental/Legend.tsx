'use client';

import React from 'react';
import { TOOTH_STATUS_COLORS, DEFAULT_TOOTH_COLOR } from '@/types/dental-record';

type LegendItem = {
  label: string;
  color: string;
  description?: string;
};

const LEGEND_ITEMS: LegendItem[] = [
  { label: '治療済み', color: TOOTH_STATUS_COLORS.cavity_completed },
  { label: '経過観察', color: TOOTH_STATUS_COLORS.observation },
  { label: '治療中', color: TOOTH_STATUS_COLORS.in_treatment }, // ★NEW
  { label: '治療予定', color: TOOTH_STATUS_COLORS.cavity_planned },
  { label: '記録なし', color: DEFAULT_TOOTH_COLOR },
];

export default function Legend() {
  return (
    <div className="mt-3 px-4">
      <div className="flex justify-center flex-wrap gap-x-4 gap-y-1.5 text-[9px] text-slate-400">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full border border-slate-200"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
