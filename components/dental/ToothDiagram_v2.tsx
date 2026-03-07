'use client';

import React, { useState, useRef } from 'react';
import { DentalRecord, DEFAULT_TOOTH_COLOR } from '@/types/dental-record';
import { getToothShortName } from '@/lib/dental-tooth-names';
import { logEvent } from '@/lib/analytics';

type ToothDiagramProps = {
  record: DentalRecord | null;
  onToothClick?: (toothNumber: string) => void;
  isKidsMode?: boolean;
  userId?: string;
};

/**
 * 個別の歯コンポーネント（かわいい丸み）
 */
const Tooth = ({
  number,
  color,
  onClick,
  isMolar = false
}: {
  number: string;
  color: string;
  onClick?: () => void;
  isMolar?: boolean;
}) => {
  const isDefault = color === DEFAULT_TOOTH_COLOR;

  return (
    <div
      onClick={onClick}
      className="relative cursor-pointer group transition-transform hover:scale-105"
      style={{
        width: isMolar ? '38px' : '32px',
        height: '28px',
      }}
    >
      {/* 歯の形（シンプルな楕円） */}
      <div
        className="w-full h-full rounded-full transition-all duration-200"
        style={{
          backgroundColor: color,
          border: isDefault ? '1.5px solid #e2e8f0' : '1.5px solid rgba(255,255,255,0.4)',
          boxShadow: isDefault ? 'inset 0 1px 2px rgba(0,0,0,0.05)' : '0 2px 6px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3)',
        }}
      >
        {/* 内側の光沢（ツヤ） */}
        <div className="w-full h-1/2 rounded-t-full bg-gradient-to-b from-white/25 to-transparent" />
      </div>

      {/* 歯番号ラベル */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 font-semibold whitespace-nowrap pointer-events-none">
        {number}
      </div>

      {/* ホバー効果（キラキラ） */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-300/0 to-purple-300/0 group-hover:from-blue-300/25 group-hover:to-purple-300/25 transition-all duration-300" />
    </div>
  );
};

/**
 * アーチ風グリッドオドントグラム
 */
export default function ToothDiagram({ record, onToothClick, isKidsMode = false, userId }: ToothDiagramProps) {
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
  const clickTimeRef = useRef<number | null>(null);

  const getToothColor = (toothNumber: string): string => {
    const data = record?.tooth_data?.[toothNumber];
    if (!data) return DEFAULT_TOOTH_COLOR;
    return data.color;
  };

  const handleToothClick = (toothNumber: string) => {
    // クリック時刻を記録
    clickTimeRef.current = Date.now();

    setSelectedTooth(toothNumber);
    if (onToothClick) {
      onToothClick(toothNumber);
    }
  };

  const handleCloseDetail = () => {
    // 閲覧時間を計測してログ記録
    if (selectedTooth && clickTimeRef.current) {
      const viewDuration = Math.round((Date.now() - clickTimeRef.current) / 1000);

      logEvent({
        eventName: 'tooth_detail_close',
        userId: userId,
        metadata: {
          tooth_number: selectedTooth,
          view_duration_seconds: viewDuration,
          is_kids_mode: isKidsMode,
        },
      });
    }

    setSelectedTooth(null);
    clickTimeRef.current = null;
  };

  // 永久歯の配置（1段表示）
  // 奥歯（6,7,8番）は isMolar フラグを立てる
  const isMolar = (num: string) => {
    const lastDigit = num.charAt(1);
    return lastDigit === '6' || lastDigit === '7' || lastDigit === '8';
  };

  return (
    <div className="w-full px-2 py-1">
      {/* 背景の柔らかいグラデーション */}
      <div className="bg-gradient-to-b from-blue-50/30 to-transparent rounded-2xl p-3 pb-4">
        {/* ヘッダーラベル */}
        <div className="text-center text-xs text-slate-500 font-bold mb-2">
          ✨ 上の歯 ✨
        </div>

        {/* 上顎（1段表示） */}
        <div className="mb-6">
          <div className="flex justify-center items-center gap-1.5">
            <Tooth number="18" color={getToothColor('18')} onClick={() => handleToothClick('18')} isMolar={true} />
            <Tooth number="17" color={getToothColor('17')} onClick={() => handleToothClick('17')} isMolar={true} />
            <Tooth number="16" color={getToothColor('16')} onClick={() => handleToothClick('16')} isMolar={true} />
            <Tooth number="15" color={getToothColor('15')} onClick={() => handleToothClick('15')} />
            <Tooth number="14" color={getToothColor('14')} onClick={() => handleToothClick('14')} />
            <Tooth number="13" color={getToothColor('13')} onClick={() => handleToothClick('13')} />
            <Tooth number="12" color={getToothColor('12')} onClick={() => handleToothClick('12')} />
            <Tooth number="11" color={getToothColor('11')} onClick={() => handleToothClick('11')} />

            {/* 中央線（細くて柔らかい） */}
            <div className="w-0.5 h-6 bg-gradient-to-b from-slate-300 to-slate-200 rounded-full mx-1.5" />

            <Tooth number="21" color={getToothColor('21')} onClick={() => handleToothClick('21')} />
            <Tooth number="22" color={getToothColor('22')} onClick={() => handleToothClick('22')} />
            <Tooth number="23" color={getToothColor('23')} onClick={() => handleToothClick('23')} />
            <Tooth number="24" color={getToothColor('24')} onClick={() => handleToothClick('24')} />
            <Tooth number="25" color={getToothColor('25')} onClick={() => handleToothClick('25')} />
            <Tooth number="26" color={getToothColor('26')} onClick={() => handleToothClick('26')} isMolar={true} />
            <Tooth number="27" color={getToothColor('27')} onClick={() => handleToothClick('27')} isMolar={true} />
            <Tooth number="28" color={getToothColor('28')} onClick={() => handleToothClick('28')} isMolar={true} />
          </div>
        </div>

        {/* 下顎ラベル */}
        <div className="text-center text-xs text-slate-400 font-bold mb-2">
          ✨ 下の歯 ✨
        </div>

        {/* 下顎（1段表示） */}
        <div>
          <div className="flex justify-center items-center gap-1.5">
            <Tooth number="48" color={getToothColor('48')} onClick={() => handleToothClick('48')} isMolar={true} />
            <Tooth number="47" color={getToothColor('47')} onClick={() => handleToothClick('47')} isMolar={true} />
            <Tooth number="46" color={getToothColor('46')} onClick={() => handleToothClick('46')} isMolar={true} />
            <Tooth number="45" color={getToothColor('45')} onClick={() => handleToothClick('45')} />
            <Tooth number="44" color={getToothColor('44')} onClick={() => handleToothClick('44')} />
            <Tooth number="43" color={getToothColor('43')} onClick={() => handleToothClick('43')} />
            <Tooth number="42" color={getToothColor('42')} onClick={() => handleToothClick('42')} />
            <Tooth number="41" color={getToothColor('41')} onClick={() => handleToothClick('41')} />

            {/* 中央線（細くて柔らかい） */}
            <div className="w-0.5 h-6 bg-gradient-to-b from-slate-200 to-slate-300 rounded-full mx-1.5" />

            <Tooth number="31" color={getToothColor('31')} onClick={() => handleToothClick('31')} />
            <Tooth number="32" color={getToothColor('32')} onClick={() => handleToothClick('32')} />
            <Tooth number="33" color={getToothColor('33')} onClick={() => handleToothClick('33')} />
            <Tooth number="34" color={getToothColor('34')} onClick={() => handleToothClick('34')} />
            <Tooth number="35" color={getToothColor('35')} onClick={() => handleToothClick('35')} />
            <Tooth number="36" color={getToothColor('36')} onClick={() => handleToothClick('36')} isMolar={true} />
            <Tooth number="37" color={getToothColor('37')} onClick={() => handleToothClick('37')} isMolar={true} />
            <Tooth number="38" color={getToothColor('38')} onClick={() => handleToothClick('38')} isMolar={true} />
          </div>
        </div>
      </div>

      {/* 選択された歯の情報表示（かわいいデザイン） */}
      {selectedTooth && record?.tooth_data?.[selectedTooth] && (
        <div className="mt-4 mx-1 p-3 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border-2 border-blue-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* 歯のアイコン */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-md"
                style={{ backgroundColor: record.tooth_data[selectedTooth].color }}
              >
                🦷
              </div>
              <div>
                <p className="text-xs font-bold text-blue-900">
                  {getToothShortName(selectedTooth)}
                </p>
                <p className="text-[10px] text-blue-600 font-medium">
                  {record.tooth_data[selectedTooth].status_label}
                </p>
              </div>
            </div>
            <button
              onClick={handleCloseDetail}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-white/50 text-blue-400 hover:bg-white hover:text-blue-600 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
