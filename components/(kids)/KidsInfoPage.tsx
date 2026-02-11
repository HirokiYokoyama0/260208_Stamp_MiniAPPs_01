"use client";

import Link from "next/link";
import { Settings } from "lucide-react";

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
      {/* 設定リンク */}
      <section className="mb-6">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-xl border-2 border-kids-purple/30 bg-kids-purple/10 p-4 transition-colors hover:bg-kids-purple/20"
        >
          <Settings className="text-kids-purple" size={20} />
          <div className="flex-1">
            <p className="font-bold text-gray-800">せってい</p>
            <p className="text-xs text-gray-500">おとなモード・こどもモードのきりかえ</p>
          </div>
          <span className="text-kids-purple">›</span>
        </Link>
      </section>

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
