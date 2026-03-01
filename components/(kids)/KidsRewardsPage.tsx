"use client";

/**
 * 子供用特典ページ
 * Phase 2で別の開発者が実装予定
 *
 * デザイン要件:
 * - 特典にキャラクターイラスト付き
 * - 子供向けの名称（例：「ピカピカはみがきごほうび」）
 * - カラフルなカード型デザイン
 * - 交換ボタンが大きくてわかりやすい
 */
export default function KidsRewardsPage() {
  return (
    <div className="min-h-screen px-4 py-6 font-kids bg-gradient-to-br from-kids-pink to-kids-yellow">
      <div className="rounded-xl bg-white/80 p-6 text-center">
        <p className="text-4xl">🎁</p>
        <h2 className="mt-4 text-xl font-bold text-kids-purple">
          ごほうび
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          （じゅんびちゅう）
        </p>
      </div>
    </div>
  );
}
