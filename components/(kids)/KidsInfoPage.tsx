"use client";

import Link from "next/link";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useRouter } from "next/navigation";
import { Settings, MapPin, Clock, Phone, ExternalLink, ArrowLeft } from "lucide-react";

export default function KidsInfoPage() {
  const { viewMode, setSelectedChildId, setViewMode } = useViewMode();
  const router = useRouter();

  // 親の画面に戻る
  const handleBackToParent = async () => {
    setSelectedChildId(null);
    await setViewMode('adult');
    router.push('/');
  };

  return (
    <div className="px-4 py-6 font-kids">
      {/* 親の画面に戻るボタン（キッズモードの場合に表示） */}
      {viewMode === 'kids' && (
        <div className="mb-4">
          <button
            onClick={handleBackToParent}
            className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-kids-purple shadow-lg transition-all hover:bg-white active:scale-95"
          >
            <ArrowLeft size={20} />
            おやの がめんに もどる
          </button>
        </div>
      )}

      {/* せってい */}
      <section className="mb-5">
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

      {/* びょういんのなまえ */}
      <section className="mb-5 rounded-xl bg-kids-blue/10 p-5 text-center">
        <p className="text-3xl">🏥</p>
        <h2 className="mt-2 text-lg font-bold text-kids-blue">
          つくばホワイトしか
        </h2>
        <p className="mt-1 text-xs text-gray-500">はいしゃさん</p>
      </section>

      {/* ばしょ */}
      <section className="mb-5 rounded-xl border-2 border-kids-green/30 bg-kids-green/10 p-4">
        <div className="mb-2 flex items-center gap-2">
          <MapPin className="text-kids-green" size={20} />
          <h3 className="font-bold text-gray-800">ばしょ</h3>
        </div>
        <p className="text-sm text-gray-700">
          いばらきけん つくばし かりま 1885-1
        </p>
        <a
          href="https://maps.app.goo.gl/29Khi5oVAFKx5uiJ6"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-kids-green hover:underline"
        >
          <MapPin size={16} />
          ちずをひらく
        </a>
        <p className="mt-2 text-xs text-gray-500">
          くるまをとめるところが 13だいぶん あるよ
        </p>
      </section>

      {/* じかん */}
      <section className="mb-5 rounded-xl border-2 border-kids-yellow/30 bg-kids-yellow/10 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Clock className="text-kids-yellow" size={20} />
          <h3 className="font-bold text-gray-800">やっているじかん</h3>
        </div>
        <div className="space-y-2 text-sm text-gray-700">
          <div className="flex items-center gap-2">
            <span className="rounded bg-kids-blue/20 px-2 py-0.5 text-xs font-bold text-kids-blue">
              げつ〜ど
            </span>
            <span>あさ 9:00 〜 よる 18:00</span>
          </div>
          <div className="rounded-lg bg-white/60 p-2 text-xs text-gray-500">
            おひるやすみ: 13:00 〜 14:30
          </div>
        </div>
      </section>

      {/* おやすみのひ */}
      <section className="mb-5 rounded-xl border-2 border-kids-pink/30 bg-kids-pink/10 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-lg">💤</span>
          <h3 className="font-bold text-gray-800">おやすみのひ</h3>
        </div>
        <p className="text-sm text-gray-700">にちようび・しゅくじつ</p>
        <p className="mt-2 text-xs text-gray-500">
          おやすみがかわることもあるよ。こうしき LINE でおしらせするね
        </p>
      </section>

      {/* でんわ・ホームページ */}
      <section className="mb-5 rounded-xl border-2 border-kids-blue/30 bg-kids-blue/10 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Phone className="text-kids-blue" size={20} />
          <h3 className="font-bold text-gray-800">れんらくさき</h3>
        </div>
        <a
          href="https://4182jp.net/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-bold text-kids-blue hover:underline"
        >
          ホームページをみる
          <ExternalLink size={14} />
        </a>
      </section>
    </div>
  );
}
