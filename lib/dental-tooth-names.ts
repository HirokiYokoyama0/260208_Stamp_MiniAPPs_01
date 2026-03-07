/**
 * 歯の名称マッピング（ISO 3950）
 * 参考: Doc_miniApps/54_ケア記録機能_LIFF開発者向け.md
 */

import { ToothNumber } from '@/types/dental-record';

/**
 * 永久歯の名称マッピング
 */
const PERMANENT_TOOTH_NAMES: Record<string, string> = {
  // 上顎右（18-11）
  '18': '右上第三大臼歯（親知らず）',
  '17': '右上第二大臼歯',
  '16': '右上第一大臼歯',
  '15': '右上第二小臼歯',
  '14': '右上第一小臼歯',
  '13': '右上犬歯',
  '12': '右上側切歯',
  '11': '右上中切歯',

  // 上顎左（21-28）
  '21': '左上中切歯',
  '22': '左上側切歯',
  '23': '左上犬歯',
  '24': '左上第一小臼歯',
  '25': '左上第二小臼歯',
  '26': '左上第一大臼歯',
  '27': '左上第二大臼歯',
  '28': '左上第三大臼歯（親知らず）',

  // 下顎左（31-38）
  '31': '左下中切歯',
  '32': '左下側切歯',
  '33': '左下犬歯',
  '34': '左下第一小臼歯',
  '35': '左下第二小臼歯',
  '36': '左下第一大臼歯',
  '37': '左下第二大臼歯',
  '38': '左下第三大臼歯（親知らず）',

  // 下顎右（41-48）
  '41': '右下中切歯',
  '42': '右下側切歯',
  '43': '右下犬歯',
  '44': '右下第一小臼歯',
  '45': '右下第二小臼歯',
  '46': '右下第一大臼歯',
  '47': '右下第二大臼歯',
  '48': '右下第三大臼歯（親知らず）',
};

/**
 * 乳歯の名称マッピング
 */
const BABY_TOOTH_NAMES: Record<string, string> = {
  // 上顎右（55-51）
  '55': '右上第二乳臼歯',
  '54': '右上第一乳臼歯',
  '53': '右上乳犬歯',
  '52': '右上乳側切歯',
  '51': '右上乳中切歯',

  // 上顎左（61-65）
  '61': '左上乳中切歯',
  '62': '左上乳側切歯',
  '63': '左上乳犬歯',
  '64': '左上第一乳臼歯',
  '65': '左上第二乳臼歯',

  // 下顎左（71-75）
  '71': '左下乳中切歯',
  '72': '左下乳側切歯',
  '73': '左下乳犬歯',
  '74': '左下第一乳臼歯',
  '75': '左下第二乳臼歯',

  // 下顎右（81-85）
  '81': '右下乳中切歯',
  '82': '右下乳側切歯',
  '83': '右下乳犬歯',
  '84': '右下第一乳臼歯',
  '85': '右下第二乳臼歯',
};

/**
 * 全ての歯の名称マッピング
 */
export const TOOTH_NAMES = {
  ...PERMANENT_TOOTH_NAMES,
  ...BABY_TOOTH_NAMES,
};

/**
 * 歯番号から歯の名称を取得
 */
export function getToothName(toothNumber: string): string {
  return TOOTH_NAMES[toothNumber] || `歯番号${toothNumber}`;
}

/**
 * 簡略名称を取得（スペース節約用）
 */
export function getToothShortName(toothNumber: string): string {
  const name = TOOTH_NAMES[toothNumber];
  if (!name) return `歯${toothNumber}`;

  // 簡略化ルール
  return name
    .replace('右上', 'R上')
    .replace('左上', 'L上')
    .replace('右下', 'R下')
    .replace('左下', 'L下')
    .replace('第一', '1')
    .replace('第二', '2')
    .replace('第三', '3')
    .replace('大臼歯', '大臼')
    .replace('小臼歯', '小臼')
    .replace('乳臼歯', '乳臼')
    .replace('中切歯', '中切')
    .replace('側切歯', '側切')
    .replace('犬歯', '犬')
    .replace('（親知らず）', '');
}

/**
 * 永久歯番号の配列（上下左右の順）
 */
export const PERMANENT_TEETH: string[] = [
  // 上顎右
  '18', '17', '16', '15', '14', '13', '12', '11',
  // 上顎左
  '21', '22', '23', '24', '25', '26', '27', '28',
  // 下顎左
  '31', '32', '33', '34', '35', '36', '37', '38',
  // 下顎右
  '41', '42', '43', '44', '45', '46', '47', '48',
];

/**
 * 乳歯番号の配列（上下左右の順）
 */
export const BABY_TEETH: string[] = [
  // 上顎右
  '55', '54', '53', '52', '51',
  // 上顎左
  '61', '62', '63', '64', '65',
  // 下顎左
  '71', '72', '73', '74', '75',
  // 下顎右
  '81', '82', '83', '84', '85',
];

/**
 * 歯番号が乳歯かどうか判定
 */
export function isBabyTooth(toothNumber: string): boolean {
  const num = parseInt(toothNumber, 10);
  return num >= 51 && num <= 85;
}

/**
 * 歯番号が永久歯かどうか判定
 */
export function isPermanentTooth(toothNumber: string): boolean {
  const num = parseInt(toothNumber, 10);
  return num >= 11 && num <= 48;
}
