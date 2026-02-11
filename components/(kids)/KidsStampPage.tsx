"use client";

/**
 * 子供用スタンプページ
 * Phase 2で別の開発者が実装予定
 *
 * デザイン要件:
 * - スタンプがキャラクター風のイラスト
 * - アニメーション付き（バウンド、回転など）
 * - 達成時に紙吹雪エフェクト
 * - 大きな数字表示（視認性重視）
 * - 励ましメッセージ（「あと3こで ごほうびだよ！」）
 */
export default function KidsStampPage() {
  return (
    <div className="px-4 py-6 font-kids">
      <div className="rounded-xl bg-kids-yellow/10 p-6 text-center">
        <p className="text-4xl">⭐</p>
        <h2 className="mt-4 text-xl font-bold text-kids-blue">
          スタンプ
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          （じゅんびちゅう）
        </p>
      </div>
    </div>
  );
}
