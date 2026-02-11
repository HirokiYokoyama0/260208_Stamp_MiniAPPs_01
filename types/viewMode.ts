/**
 * 表示モードの型定義
 */
export type ViewMode = 'adult' | 'kids';

/**
 * ページコンポーネントの共通Props
 * 大人用・子供用で同じPropsを受け取るように統一
 */
export interface PageProps {
  viewMode: ViewMode;
  userId: string;
  userName: string;
}

/**
 * スタンプカードの共通Props
 */
export interface StampCardProps {
  stampCount: number;
  stampGoal: number;
  viewMode: ViewMode;
}
