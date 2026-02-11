"use client";

/**
 * 子供用医院情報ページ
 * Phase 2で別の開発者が実装予定
 *
 * デザイン要件:
 * - イラスト入りの地図
 * - わかりやすい診療時間表示
 * - 親しみやすいトーン
 */
export default function KidsInfoPage() {
  return (
    <div className="px-4 py-6 font-kids">
      <div className="rounded-xl bg-kids-blue/10 p-6 text-center">
        <p className="text-4xl">🏥</p>
        <h2 className="mt-4 text-xl font-bold text-kids-blue">
          びょういんじょうほう
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          （じゅんびちゅう）
        </p>
      </div>
    </div>
  );
}
