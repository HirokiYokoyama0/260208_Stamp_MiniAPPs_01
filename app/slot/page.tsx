"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLiff } from "@/hooks/useLiff";
import { logSlotGamePlay, logEvent } from "@/lib/analytics";

// 歯科テーマの絵文字リール（色・形がすべて異なる7種）
// 🦷白/歯  🪥多色/ブラシ  🍎赤/丸  ⭐黄/星  💎青/菱  🌸桃/花  🍀緑/葉
const SYMBOLS = ["🦷", "🪥", "🍎", "⭐", "💎", "🌸", "🍀"];

// 当たりパターンの定義
const WINNING_PATTERNS: Record<string, { label: string; message: string }> = {
  "🦷🦷🦷": { label: "だいあたり！", message: "はが ピッカピカ！すごいね！" },
  "🪥🪥🪥": { label: "あたり！", message: "はみがき マスター！えらい！" },
  "🍎🍎🍎": { label: "あたり！", message: "りんご いっぱい！おいしいね！" },
  "⭐⭐⭐": { label: "あたり！", message: "おほしさま キラキラ！" },
  "💎💎💎": { label: "あたり！", message: "ダイヤモンド みたいにピカピカ！" },
  "🌸🌸🌸": { label: "あたり！", message: "おはな まんかい！きれいだね！" },
  "🍀🍀🍀": { label: "あたり！", message: "よつば の クローバー！ラッキー！" },
};

function getRandomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

// 単一リールコンポーネント（タップで停止）
function SlotReel({
  index,
  spinning,
  onStop,
  stopped,
}: {
  index: number;
  spinning: boolean;
  onStop: (index: number, symbol: string) => void;
  stopped: boolean;
}) {
  const [display, setDisplay] = useState("🦷");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const displayRef = useRef(display);

  // displayRefを常に最新に保つ
  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  // スピン開始
  useEffect(() => {
    if (spinning && !stopped) {
      intervalRef.current = setInterval(() => {
        const sym = getRandomSymbol();
        setDisplay(sym);
        displayRef.current = sym;
      }, 80);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [spinning, stopped]);

  const handleStop = () => {
    if (!spinning || stopped) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    onStop(index, displayRef.current);
  };

  const canTap = spinning && !stopped;

  return (
    <button
      type="button"
      onClick={handleStop}
      disabled={!canTap}
      className={`flex h-24 w-24 items-center justify-center rounded-2xl border-4 bg-white text-5xl shadow-inner transition-all ${
        canTap
          ? "animate-pulse border-kids-yellow active:scale-90"
          : stopped
            ? "border-kids-green"
            : "border-kids-pink/30"
      }`}
    >
      {display}
    </button>
  );
}

export default function SlotPage() {
  const { profile } = useLiff();
  const [spinning, setSpinning] = useState(false);
  const [stoppedReels, setStoppedReels] = useState<(string | null)[]>([
    null,
    null,
    null,
  ]);
  const [result, setResult] = useState<{
    label: string;
    message: string;
  } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [spinKey, setSpinKey] = useState(0);

  // ページ読み込み時にログ
  useEffect(() => {
    logEvent({
      eventName: 'slot_game_open',
      userId: profile?.userId,
    });
  }, [profile?.userId]);

  // 全リール停止時に結果判定
  const checkResult = useCallback((reels: (string | null)[]) => {
    if (reels.some((r) => r === null)) return;
    const key = reels.join("");
    const win = WINNING_PATTERNS[key];
    if (win) {
      setResult(win);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      // 当たりログ
      logSlotGamePlay({
        result: 'win',
        stampsWon: win.label.includes('だいあたり') ? 8 : 5,
        userId: profile?.userId,
      });
    } else if (reels[0] === reels[1] || reels[1] === reels[2]) {
      setResult({ label: "おしい！", message: "もうちょっとだよ！" });
      // 外れログ
      logSlotGamePlay({
        result: 'lose',
        stampsWon: 0,
        userId: profile?.userId,
      });
    } else {
      // 完全に外れた場合もログ
      logSlotGamePlay({
        result: 'lose',
        stampsWon: 0,
        userId: profile?.userId,
      });
    }
    setSpinning(false);
  }, [profile?.userId]);

  const handleStop = useCallback(
    (index: number, symbol: string) => {
      setStoppedReels((prev) => {
        const next = [...prev];
        next[index] = symbol;
        // 次のティックで結果判定
        setTimeout(() => checkResult(next), 50);
        return next;
      });
    },
    [checkResult]
  );

  const spin = () => {
    if (spinning) return;
    setResult(null);
    setShowConfetti(false);
    setStoppedReels([null, null, null]);
    setSpinKey((k) => k + 1);
    setSpinning(true);
  };

  const stoppedCount = stoppedReels.filter((r) => r !== null).length;
  const isWin = result && result.label.includes("あたり");

  return (
    <div className="relative min-h-[calc(100vh-120px)] overflow-hidden px-4 py-6 font-kids">
      {/* 紙吹雪エフェクト */}
      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 z-30">
          {Array.from({ length: 30 }).map((_, i) => (
            <span
              key={i}
              className="absolute animate-bounce text-2xl"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 80}%`,
                animationDelay: `${Math.random() * 1}s`,
                animationDuration: `${0.8 + Math.random() * 1.2}s`,
              }}
            >
              {["🎉", "⭐", "🌸", "🍀", "💎", "🦷"][i % 6]}
            </span>
          ))}
        </div>
      )}

      {/* 戻るボタン */}
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-kids-pink"
      >
        <ArrowLeft size={16} />
        もどる
      </Link>

      {/* ヘッダー */}
      <div className="mb-6 text-center">
        <Image
          src="/images/haburashika.jpg"
          alt="ハブラーシカ"
          width={80}
          height={80}
          className="mx-auto rounded-full border-4 border-kids-yellow shadow-md"
        />
        <h2 className="mt-2 text-2xl font-bold text-kids-pink">
          🎰 スロットゲーム
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          3つ そろえて あたり！
        </p>
      </div>

      {/* スロットマシン */}
      <div className="mx-auto max-w-xs">
        <div className="rounded-3xl border-4 border-kids-purple/30 bg-gradient-to-b from-kids-blue/10 to-kids-purple/10 p-6 shadow-lg">
          {/* タップで止めてねガイド */}
          {spinning && stoppedCount < 3 && (
            <p className="mb-3 text-center text-sm font-bold text-kids-blue animate-pulse">
              👆 タップして とめてね！
            </p>
          )}

          {/* リール */}
          <div className="flex items-center justify-center gap-3">
            {[0, 1, 2].map((i) => (
              <SlotReel
                key={`${i}-${spinKey}`}
                index={i}
                spinning={spinning}
                stopped={stoppedReels[i] !== null}
                onStop={handleStop}
              />
            ))}
          </div>

          {/* 停止状況 */}
          {spinning && (
            <div className="mt-3 flex justify-center gap-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full ${
                    stoppedReels[i] !== null ? "bg-kids-green" : "bg-gray-300"
                  }`}
                />
              ))}
            </div>
          )}

          {/* 結果表示 */}
          <div className="mt-5 min-h-[60px] text-center">
            {result && (
              <div
                className={`animate-bounce rounded-xl p-3 ${
                  isWin ? "bg-kids-yellow/30" : "bg-gray-100"
                }`}
              >
                <p
                  className={`text-xl font-bold ${
                    isWin ? "text-kids-pink" : "text-gray-600"
                  }`}
                >
                  {result.label}
                </p>
                <p className="mt-1 text-sm text-gray-600">{result.message}</p>
              </div>
            )}
          </div>

          {/* スピンボタン */}
          <button
            onClick={spin}
            disabled={spinning}
            className={`mt-4 w-full rounded-full py-4 text-lg font-bold text-white shadow-lg transition-all active:scale-95 ${
              spinning
                ? "bg-gray-300"
                : "bg-gradient-to-r from-kids-pink to-kids-purple hover:shadow-xl"
            }`}
          >
            {spinning ? "まわしてるよ..." : "🎰 まわす！"}
          </button>
        </div>
      </div>

      {/* あたりの説明 */}
      <div className="mx-auto mt-6 max-w-xs rounded-2xl bg-kids-yellow/10 p-4">
        <p className="mb-2 text-center text-sm font-bold text-kids-purple">
          あそびかた
        </p>
        <div className="space-y-1 text-center text-sm text-gray-600">
          <p>① 「まわす！」ボタン をおす</p>
          <p>② リールを タップして とめる</p>
          <p>③ 3つ そろったら あたり！</p>
        </div>
        <div className="mt-3 space-y-1 text-center text-sm">
          <p>🦷🦷🦷 → だいあたり！</p>
          <p>そのほか 3つ そろい → あたり！</p>
          <p className="mt-1 text-xs text-gray-400">🪥 🍎 ⭐ 💎 🌸 🍀</p>
        </div>
      </div>
    </div>
  );
}
