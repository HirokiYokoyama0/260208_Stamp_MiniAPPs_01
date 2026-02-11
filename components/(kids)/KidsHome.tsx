"use client";

/**
 * 子供用ホームページ（診察券）
 * Phase 2で別の開発者が実装予定
 *
 * デザイン要件:
 * - カラフルな背景（ピンク・イエロー・グリーン）
 * - ハブラーシカのイラストを大きく表示
 * - 丸ゴシックフォント（font-kids）
 * - 大きめのボタン（タップしやすく）
 * - 子供向けメッセージ（例：「はみがき がんばったね！」）
 */
export default function KidsHome() {
  return (
    <div className="px-4 py-6 font-kids">
      <div className="rounded-xl bg-kids-pink/10 p-6 text-center">
        <p className="text-4xl">🦷</p>
        <h2 className="mt-4 text-xl font-bold text-kids-pink">
          こどもモード
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          （じゅんびちゅう）
        </p>
      </div>
    </div>
  );
}
