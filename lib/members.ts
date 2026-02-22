/**
 * メンバー判定ユーティリティ
 *
 * 代理管理メンバー（スマホ/LINEアカウントなし）と
 * 実メンバー（LINEアカウントあり）を安全に判定する
 */

export interface MemberProfile {
  id: string;
  line_user_id: string | null;
}

/**
 * 代理管理メンバー（スマホなし子供）かどうかを判定する
 *
 * 判定基準:
 * 1. line_user_id が NULL である
 * 2. id が 'manual-' で始まる（安全のための二重チェック）
 *
 * @param profile プロフィール情報
 * @returns 代理管理メンバーなら true
 *
 * @example
 * // 代理管理メンバー
 * isProxyMember({ id: 'manual-child-001', line_user_id: null }) // true
 *
 * // 実メンバー
 * isProxyMember({ id: 'U5c70cd61...', line_user_id: 'U5c70cd61...' }) // false
 */
export const isProxyMember = (profile: MemberProfile): boolean => {
  return profile.line_user_id === null && profile.id.startsWith('manual-');
};

/**
 * 実メンバー（LINEアカウントあり）かどうかを判定する
 *
 * @param profile プロフィール情報
 * @returns 実メンバーなら true
 */
export const isRealMember = (profile: MemberProfile): boolean => {
  return !isProxyMember(profile);
};

/**
 * メンバータイプを文字列で取得
 *
 * @param profile プロフィール情報
 * @returns 'proxy' | 'real'
 */
export const getMemberType = (profile: MemberProfile): 'proxy' | 'real' => {
  return isProxyMember(profile) ? 'proxy' : 'real';
};
