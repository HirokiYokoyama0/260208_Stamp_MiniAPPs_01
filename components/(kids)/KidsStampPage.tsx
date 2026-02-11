"use client";

import Image from "next/image";

/**
 * 子供用スタンプページ
 * Phase 2で別の開発者が実装予定
 */
export default function KidsStampPage() {
  return (
    <div className="px-4 py-6 font-kids">
      <div className="rounded-xl bg-kids-yellow/10 p-6 text-center">
        <Image
          src="/images/haburashika.jpg"
          alt="ハブラーシカ"
          width={120}
          height={120}
          className="mx-auto"
        />
        <h2 className="mt-3 text-xl font-bold text-kids-blue">
          スタンプ
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          （じゅんびちゅう）
        </p>
      </div>
    </div>
  );
}
