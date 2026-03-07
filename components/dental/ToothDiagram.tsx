'use client';

import React, { useState, JSX } from 'react';
import { DentalRecord, DEFAULT_TOOTH_COLOR } from '@/types/dental-record';
import { PERMANENT_TEETH, BABY_TEETH, getToothShortName } from '@/lib/dental-tooth-names';

type ToothDiagramProps = {
  record: DentalRecord | null;
  onToothClick?: (toothNumber: string) => void;
  isKidsMode?: boolean;
};

/**
 * やさしい丸みのある歯を作成（5分割オドントグラム）
 */
const createSoftTooth = (
  cx: number,
  cy: number,
  angle: number,
  toothNum: string,
  color: string,
  isUpper: boolean,
  onClick?: () => void
) => {
  const size = 8; // スマホ最適化：さらに小さく
  const r = size / 2;
  const inner = r * 0.55;
  const deg = angle * (180 / Math.PI);
  const labelY = isUpper ? -r - 2.5 : r + 7;

  return (
    <g
      key={toothNum}
      transform={`translate(${cx}, ${cy}) rotate(${deg})`}
      onClick={onClick}
      className="cursor-pointer"
    >
      {/* 頬側 */}
      <path
        d={`M${-r},${-r} Q0,${-r - 1} ${r},${-r} L${inner},${-inner} Q0,${-inner - 0.5} ${-inner},${-inner} Z`}
        fill={color}
        stroke="#cbd5e1"
        strokeWidth="0.5"
        className="hover:opacity-80 transition-all duration-200"
      />
      {/* 遠心 */}
      <path
        d={`M${r},${-r} Q${r + 1},0 ${r},${r} L${inner},${inner} Q${inner + 0.5},0 ${inner},${-inner} Z`}
        fill={color}
        stroke="#cbd5e1"
        strokeWidth="0.5"
        className="hover:opacity-80 transition-all duration-200"
      />
      {/* 舌側 */}
      <path
        d={`M${r},${r} Q0,${r + 1} ${-r},${r} L${-inner},${inner} Q0,${inner + 0.5} ${inner},${inner} Z`}
        fill={color}
        stroke="#cbd5e1"
        strokeWidth="0.5"
        className="hover:opacity-80 transition-all duration-200"
      />
      {/* 近心 */}
      <path
        d={`M${-r},${r} Q${-r - 1},0 ${-r},${-r} L${-inner},${-inner} Q${-inner - 0.5},0 ${-inner},${inner} Z`}
        fill={color}
        stroke="#cbd5e1"
        strokeWidth="0.5"
        className="hover:opacity-80 transition-all duration-200"
      />
      {/* 咬合面（中央） */}
      <rect
        x={-inner}
        y={-inner}
        width={inner * 2}
        height={inner * 2}
        rx="1"
        fill={color}
        stroke="#cbd5e1"
        strokeWidth="0.5"
        className="hover:opacity-80 transition-all duration-200"
      />

      <g transform={`rotate(${-deg})`}>
        <text
          x="0"
          y={labelY}
          textAnchor="middle"
          fontSize="5.5"
          fill="#94a3b8"
          fontWeight="700"
          fontFamily="sans-serif"
          style={{ pointerEvents: 'none' }}
        >
          {toothNum}
        </text>
      </g>
    </g>
  );
};

export default function ToothDiagram({ record, onToothClick, isKidsMode = false }: ToothDiagramProps) {
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);

  const teeth = isKidsMode ? BABY_TEETH : PERMANENT_TEETH;

  /**
   * 歯の色を取得
   */
  const getToothColor = (toothNumber: string): string => {
    const data = record?.tooth_data?.[toothNumber];

    // Debug logging for color issue
    if (toothNumber === '34' || toothNumber === '45') {
      console.log(`[ToothDiagram] Tooth ${toothNumber}:`, {
        hasRecord: !!record,
        hasToothData: !!record?.tooth_data,
        data: data,
        allToothData: record?.tooth_data,
      });
    }

    if (!data) return DEFAULT_TOOTH_COLOR;
    return data.color;
  };

  /**
   * 歯がクリックされた時
   */
  const handleToothClick = (toothNumber: string) => {
    setSelectedTooth(toothNumber);
    if (onToothClick) {
      onToothClick(toothNumber);
    }
  };

  // U字型の配置設定（コンパクトに）
  const rx = 110; // 横幅
  const ry = 45;  // 奥行き（縮小）
  const centerX = 160;
  const centerY = 60; // 中心Y座標

  // 4つの象限の設定（上下を詰める：間隔45 → 30に）
  const configs = [
    { quadrant: 10, start: Math.PI * 1.5, end: Math.PI * 1.95, baseY: centerY - 15, count: isKidsMode ? 5 : 8 },  // 上顎右 Y=45
    { quadrant: 20, start: Math.PI * 1.5, end: Math.PI * 1.05, baseY: centerY - 15, count: isKidsMode ? 5 : 8 },  // 上顎左 Y=45
    { quadrant: 40, start: Math.PI * 0.5, end: Math.PI * 0.05, baseY: centerY + 15, count: isKidsMode ? 5 : 8 }, // 下顎右 Y=75
    { quadrant: 30, start: Math.PI * 0.5, end: Math.PI * 0.95, baseY: centerY + 15, count: isKidsMode ? 5 : 8 }, // 下顎左 Y=75
  ];

  const teethElements: JSX.Element[] = [];

  configs.forEach((cfg) => {
    const teethInQuadrant = teeth.filter(t => {
      const num = parseInt(t, 10);
      const quad = Math.floor(num / 10) * 10;
      return quad === cfg.quadrant;
    });

    teethInQuadrant.forEach((toothNum, index) => {
      const t = (index + 0.5) / 8; // 元のHTMLと同じ計算
      const angle = cfg.start + (cfg.end - cfg.start) * t;
      const x = centerX + rx * Math.cos(angle);
      const y = cfg.baseY + ry * Math.sin(angle);
      const rotateAngle = angle + Math.PI / 2;
      const color = getToothColor(toothNum);
      const isUpper = cfg.quadrant === 10 || cfg.quadrant === 20;

      teethElements.push(
        createSoftTooth(x, y, rotateAngle, toothNum, color, isUpper, () => handleToothClick(toothNum))
      );
    });
  });

  return (
    <div className="w-full max-h-[180px]">
      <svg
        viewBox="0 0 320 120"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto max-h-full"
      >
        {/* センターガイド */}
        <line
          x1="160"
          y1="5"
          x2="160"
          y2="115"
          stroke="#f1f5f9"
          strokeWidth="0.8"
          strokeDasharray="2"
        />

        {/* 歯のレイヤー */}
        <g id="teeth-layer">{teethElements}</g>

        {/* 上下ラベル */}
        <text
          x="160"
          y="10"
          textAnchor="middle"
          fontSize="6.5"
          fill="#cbd5e1"
          fontWeight="bold"
          style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
        >
          UPPER
        </text>
        <text
          x="160"
          y="115"
          textAnchor="middle"
          fontSize="6.5"
          fill="#cbd5e1"
          fontWeight="bold"
          style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
        >
          LOWER
        </text>
      </svg>

      {/* 選択された歯の情報表示 */}
      {selectedTooth && record?.tooth_data?.[selectedTooth] && (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-900">
                {getToothShortName(selectedTooth)}
              </p>
              <p className="text-[10px] text-blue-700">
                {record.tooth_data[selectedTooth].status_label}
              </p>
            </div>
            <button
              onClick={() => setSelectedTooth(null)}
              className="text-blue-400 hover:text-blue-600"
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
