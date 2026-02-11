"use client";

/**
 * 子供用ケア記録ページ
 * Phase 2で別の開発者が実装予定
 *
 * デザイン要件:
 * - 大きなチェックボックス
 * - イラスト付きのケア項目
 * - できたら「✨」などのエフェクト
 * - 継続日数を褒める仕組み
 */
export default function KidsCarePage() {
  return (
    <div className="px-4 py-6 font-kids">
      <div className="rounded-xl bg-kids-green/10 p-6 text-center">
        <p className="text-4xl">✨</p>
        <h2 className="mt-4 text-xl font-bold text-kids-green">
          ケアきろく
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          （じゅんびちゅう）
        </p>
      </div>
    </div>
  );
}
