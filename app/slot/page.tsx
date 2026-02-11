"use client";

import Image from "next/image";

export default function SlotPage() {
  return (
    <div className="px-4 py-6 font-kids">
      <div className="rounded-xl bg-kids-pink/10 p-6 text-center">
        <Image
          src="/images/haburashika.jpg"
          alt="ハブラーシカ"
          width={100}
          height={100}
          className="mx-auto"
        />
        <h2 className="mt-3 text-xl font-bold text-kids-pink">
          スロットゲーム
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          （じゅんびちゅう）
        </p>
      </div>
    </div>
  );
}
