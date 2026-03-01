"use client";

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLiff } from "@/hooks/useLiff";
import { useViewMode } from "@/contexts/ViewModeContext";
import { logSlotGamePlay, logEvent } from "@/lib/analytics";

// 歯科テーマの絵文字リール（色・形がすべて異なる7種）
const TOOTH_SYMBOL = "TOOTH";
const SYMBOLS = [TOOTH_SYMBOL, "🪥", "🍎", "⭐", "💎", "🌸", "🍀"];

// 当たりパターンの定義
const WINNING_PATTERNS: Record<string, { label: string; message: string }> = {
  [`${TOOTH_SYMBOL}${TOOTH_SYMBOL}${TOOTH_SYMBOL}`]: { label: "だいあたり！", message: "はが ピッカピカ！すごいね！" },
  "🪥🪥🪥": { label: "あたり！", message: "はみがき マスター！えらい！" },
  "🍎🍎🍎": { label: "あたり！", message: "りんご いっぱい！おいしいね！" },
  "⭐⭐⭐": { label: "あたり！", message: "おほしさま キラキラ！" },
  "💎💎💎": { label: "あたり！", message: "ダイヤモンド みたいにピカピカ！" },
  "🌸🌸🌸": { label: "あたり！", message: "おはな まんかい！きれいだね！" },
  "🍀🍀🍀": { label: "あたり！", message: "よつば の クローバー！ラッキー！" },
};

// ドラムサイズ定数（歯キャラ筐体に収まるよう調整）
const SYMBOL_HEIGHT = 64;       // 1コマの高さ (px)
const SYMBOL_WIDTH  = 70;       // 1コマの幅 (px)
const SYMBOLS_LEN = SYMBOLS.length; // 7
const CYCLE_H = SYMBOLS_LEN * SYMBOL_HEIGHT; // 448px = 1周分
const STRIP_REPEAT = 5;         // シンボルを5回繰り返して長いストリップを作る

// ストリップ: [TOOTH, 🪥, 🍎, ⭐, 💎, 🌸, 🍀] × 5 = 35コマ = 2800px
const STRIP = Array.from(
  { length: STRIP_REPEAT * SYMBOLS_LEN },
  (_, i) => SYMBOLS[i % SYMBOLS_LEN]
);

// 絵柄を描画するヘルパー（TOOTHは画像、それ以外は絵文字）
function renderSymbol(sym: string, size: number = 44) {
  if (sym === TOOTH_SYMBOL) {
    return (
      <Image
        src="/images/tooth.png"
        alt="歯"
        width={size}
        height={size}
        className="object-contain"
      />
    );
  }
  return <span style={{ fontSize: size }}>{sym}</span>;
}

// ─── ドラム式リールコンポーネント ────────────────────────────
interface DrumReelHandle {
  stop: () => void;
}

const DrumReel = forwardRef<DrumReelHandle, {
  index: number;
  spinning: boolean;
  stopped: boolean;
  onStop: (index: number, symbol: string) => void;
}>(function DrumReel({ index, spinning, stopped, onStop }, ref) {
  // offsetRef: ストリップを何px上にスクロールしたか（単調増加）
  // 全リール初期位置を0に固定して揃える。ランダム性はタップタイミングで生まれる
  const offsetRef = useRef(0);
  const speedRef = useRef(0);
  const isStoppingRef = useRef(false);
  const doneRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  // translateY state (表示用) — 初期は0（全リール揃えて表示）
  const [translateY, setTranslateY] = useState(0);

  useEffect(() => {
    if (!spinning) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    // 新しいスピン開始時にリセット
    isStoppingRef.current = false;
    doneRef.current = false;
    speedRef.current = 9; // px/frame（約60fps → 約540px/s）

    const animate = () => {
      if (doneRef.current) return;

      if (isStoppingRef.current) {
        // 減速フェーズ
        speedRef.current *= 0.88;

        if (speedRef.current < 0.3) {
          // 最も近いシンボル境界にスナップ
          const snapped = Math.round(offsetRef.current / SYMBOL_HEIGHT) * SYMBOL_HEIGHT;
          const displayOffset = snapped % CYCLE_H;
          offsetRef.current = snapped;
          setTranslateY(-displayOffset);

          // 中央のシンボルを特定
          // translateY = -displayOffset のとき:
          //   top:    STRIP[Math.floor(displayOffset / SYMBOL_HEIGHT)]
          //   center: STRIP[Math.floor(displayOffset / SYMBOL_HEIGHT) + 1]
          //   bottom: STRIP[Math.floor(displayOffset / SYMBOL_HEIGHT) + 2]
          const centerStripIdx = (Math.floor(displayOffset / SYMBOL_HEIGHT) + 1) % STRIP.length;
          const sym = STRIP[centerStripIdx];

          doneRef.current = true;
          onStop(index, sym);
          return;
        }
      }

      // スクロール更新
      offsetRef.current += speedRef.current;
      // CYCLE_H(560px)ごとにラップして無限ループ
      if (offsetRef.current >= CYCLE_H) {
        offsetRef.current -= CYCLE_H;
      }
      setTranslateY(-offsetRef.current);

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning]);

  const handleTap = () => {
    // 停止済み・停止中・完了済みは無視
    if (!spinning || stopped || isStoppingRef.current || doneRef.current) return;
    isStoppingRef.current = true;
  };

  useImperativeHandle(ref, () => ({
    stop: handleTap,
  }), [spinning, stopped]);

  const canTap = spinning && !stopped;

  return (
    <div
      onClick={handleTap}
      className={`relative overflow-hidden rounded-sm bg-white shadow-[inset_0_2px_6px_rgba(0,0,0,0.2)] transition-all select-none ring-2 ring-inset ${
        canTap
          ? "cursor-pointer ring-orange-400"
          : stopped
            ? "cursor-default ring-green-500"
            : "cursor-default ring-gray-400/30"
      }`}
      style={{ height: SYMBOL_HEIGHT * 3, width: SYMBOL_WIDTH }}
    >
      {/* スクロールするシンボルストリップ */}
      <div
        className="absolute left-0 top-0 w-full"
        style={{ transform: `translateY(${translateY}px)` }}
      >
        {STRIP.map((sym, i) => (
          <div
            key={i}
            className="flex items-center justify-center"
            style={{ height: SYMBOL_HEIGHT, width: SYMBOL_WIDTH }}
          >
            {renderSymbol(sym, 34)}
          </div>
        ))}
      </div>

      {/* オーバーレイ: 上下フェード ＋ 中央枠線 */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute top-0 left-0 right-0 bg-gradient-to-b from-white/85 to-transparent"
          style={{ height: SYMBOL_HEIGHT }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white/85 to-transparent"
          style={{ height: SYMBOL_HEIGHT }}
        />
        <div
          className="absolute left-0 right-0 border-y border-orange-400/50"
          style={{ top: SYMBOL_HEIGHT, height: SYMBOL_HEIGHT }}
        />
      </div>

      {/* タップ促進インジケーター */}
      {canTap && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="animate-ping text-[10px] font-bold text-orange-500 opacity-70">
            TAP
          </span>
        </div>
      )}
    </div>
  );
});

// ─── サウンド ────────────────────────────────────────────────
function playWinSound(isJackpot: boolean) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();

    if (isJackpot) {
      // だいあたり: C→E→G→C の上昇ファンファーレ
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t);
        osc.stop(t + 0.35);
      });
    } else {
      // あたり: 2音チャイム
      const notes = [659, 784];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.2;
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
      });
    }
  } catch {
    // AudioContext非対応環境では無音で継続
  }
}

// ─── メインページ ────────────────────────────────────────────
export default function SlotPage() {
  const { profile } = useLiff();
  // selectedChildId がある場合（子供の画面経由）はその子のIDにスタンプを付与する
  const { selectedChildId } = useViewMode();
  const targetUserId = selectedChildId ?? profile?.userId;
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
  const [stampAwarded, setStampAwarded] = useState<number | null>(null);
  const [isAwarding, setIsAwarding] = useState(false);

  // StrictMode の二重実行対策: ref でリール停止状態と付与状態を管理
  const stoppedReelsRef = useRef<(string | null)[]>([null, null, null]);
  const isAwardingRef = useRef(false);
  const reelRefs = useRef<(DrumReelHandle | null)[]>([null, null, null]);

  useEffect(() => {
    logEvent({ eventName: "slot_game_open", userId: profile?.userId });
  }, [profile?.userId]);

  // スロット結果に応じてスタンプをAPIで付与
  const awardSlotStamps = useCallback(
    async (stamps: number) => {
      if (!targetUserId) return;
      // StrictMode の二重呼び出し防止: ref で排他制御
      if (isAwardingRef.current) return;
      isAwardingRef.current = true;
      setIsAwarding(true);
      try {
        const res = await fetch("/api/stamps/slot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: targetUserId, stamps }),
        });
        const data = await res.json();
        if (data.success) {
          setStampAwarded(stamps);
        }
      } catch {
        // ネットワークエラーは無音で継続
      } finally {
        setIsAwarding(false);
      }
    },
    [targetUserId]
  );

  // 全リール停止時に結果判定 + スタンプ付与
  const checkResult = useCallback(
    (reels: (string | null)[]) => {
      if (reels.some((r) => r === null)) return;
      const key = reels.join("");
      const win = WINNING_PATTERNS[key];
      let stampsWon = 1;
      if (win) {
        stampsWon = win.label.includes("だいあたり") ? 8 : 5;
        setResult(win);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
        playWinSound(win.label.includes("だいあたり"));
        logSlotGamePlay({ result: "win", stampsWon, userId: profile?.userId });
      } else if (reels[0] === reels[1] || reels[1] === reels[2]) {
        setResult({ label: "おしい！", message: "もうちょっとだよ！またやってみよう！" });
        logSlotGamePlay({ result: "lose", stampsWon: 1, userId: profile?.userId });
      } else {
        setResult({ label: "はずれ...", message: "またちゃれんじしてね！" });
        logSlotGamePlay({ result: "lose", stampsWon: 1, userId: profile?.userId });
      }
      setSpinning(false);
      awardSlotStamps(stampsWon);
    },
    [profile?.userId, awardSlotStamps]
  );

  const handleStop = useCallback(
    (index: number, symbol: string) => {
      // ref を先に更新してからスケジュール（state updater の外に出して StrictMode 二重実行を防ぐ）
      const next = [...stoppedReelsRef.current];
      next[index] = symbol;
      stoppedReelsRef.current = next;
      setStoppedReels([...next]);
      setTimeout(() => checkResult(next), 50);
    },
    [checkResult]
  );

  const spin = () => {
    if (spinning) return;
    // 次のスピンのために ref をリセット
    stoppedReelsRef.current = [null, null, null];
    isAwardingRef.current = false;
    setResult(null);
    setShowConfetti(false);
    setStampAwarded(null);
    setStoppedReels([null, null, null]);
    setSpinKey((k) => k + 1);
    setSpinning(true);
  };

  const stopNextReel = () => {
    if (!spinning) return;
    const nextIdx = stoppedReels.findIndex((r) => r === null);
    if (nextIdx !== -1) {
      reelRefs.current[nextIdx]?.stop();
    }
  };

  const stoppedCount = stoppedReels.filter((r) => r !== null).length;
  const isWin = result && result.label.includes("あたり");

  return (
    <div className="relative flex min-h-[calc(100vh-120px)] flex-col items-center overflow-hidden bg-[#6E93B8] px-4 py-3 font-kids">
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
        className="mb-2 self-start inline-flex items-center gap-1 text-sm text-white/80"
      >
        <ArrowLeft size={16} />
        もどる
      </Link>

      {/* ── スロット機 ── */}
      <div className="mx-auto w-full max-w-[300px]">
        <div className="flex flex-col items-center px-3">

          {/* ── オレンジのスロットパネル ── */}
          <div className="w-full rounded-2xl border-4 border-orange-700 bg-orange-500 p-2 shadow-[0_4px_14px_rgba(0,0,0,0.3),inset_0_2px_8px_rgba(255,180,0,0.25)]">

            {/* タップガイド */}
            <div className="mb-1.5 h-5 text-center">
              {spinning && stoppedCount < 3 && (
                <p className="animate-pulse text-[11px] font-bold text-yellow-100">
                  👆 タップして とめてね！
                </p>
              )}
            </div>

            {/* リールウィンドウ（グレー背景） */}
            <div className="relative rounded-xl bg-gray-200 p-1.5 shadow-[inset_0_3px_10px_rgba(0,0,0,0.35)]">
              {/* ペイライン（中央の赤横線） */}
              <div
                className="pointer-events-none absolute inset-x-1.5 z-10 h-[2px] bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)]"
                style={{ top: SYMBOL_HEIGHT + SYMBOL_HEIGHT / 2 - 1 }}
              />
              {/* ドラムリール × 3 */}
              <div className="flex items-start justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <DrumReel
                    key={`${i}-${spinKey}`}
                    ref={(el) => { reelRefs.current[i] = el; }}
                    index={i}
                    spinning={spinning}
                    stopped={stoppedReels[i] !== null}
                    onStop={handleStop}
                  />
                ))}
              </div>
            </div>

            {/* 停止インジケーター */}
            <div className="mt-1.5 flex h-3 justify-center gap-2.5">
              {spinning && [0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    stoppedReels[i] !== null ? "bg-green-300" : "bg-orange-300/40"
                  }`}
                />
              ))}
            </div>

            {/* 結果表示 */}
            <div
              className={`mt-1.5 flex min-h-[44px] flex-col items-center justify-center rounded-xl px-2 py-1 transition-all ${
                isWin
                  ? "bg-yellow-200 shadow-[0_0_10px_rgba(234,179,8,0.6)]"
                  : "bg-orange-200/80"
              }`}
            >
              {result ? (
                <>
                  <p
                    className={`text-base font-black ${
                      isWin ? "animate-pulse text-orange-700" : "text-orange-900"
                    }`}
                  >
                    {result.label}
                  </p>
                  <p className="text-[10px] text-orange-700">{result.message}</p>
                  {isAwarding && (
                    <p className="mt-0.5 animate-pulse text-[10px] text-orange-500">
                      スタンプ つけてるよ...
                    </p>
                  )}
                  {stampAwarded !== null && !isAwarding && (
                    <p className="mt-0.5 text-sm font-black text-yellow-700">
                      🌟 {stampAwarded}こ スタンプ ゲット！
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-orange-500/50">─ ─ まわしてね ─ ─</p>
              )}
            </div>
          </div>

          {/* スピン／ストップボタン（3D押しボタン風） */}
          <button
            onClick={spinning ? stopNextReel : spin}
            className={`mt-4 w-full rounded-full border-b-4 py-3.5 text-base font-black tracking-wider transition-all active:translate-y-1 active:border-b-0 ${
              spinning
                ? "border-red-800 bg-gradient-to-b from-red-400 to-red-600 text-white shadow-lg"
                : "border-orange-800 bg-gradient-to-b from-orange-400 to-orange-600 text-white shadow-lg"
            }`}
          >
            {spinning ? "🛑  とめる！" : "🎰  まわす！"}
          </button>
        </div>
      </div>

      {/* あそびかた */}
      <div className="mx-auto mt-4 w-full max-w-[300px] rounded-2xl bg-white/70 p-3 shadow-sm">
        <p className="mb-1 text-center text-xs font-bold text-orange-700">あそびかた</p>
        <div className="space-y-0.5 text-center text-xs text-gray-600">
          <p>① まわす！ボタンをおす</p>
          <p>② リールをタップ or ボタンでとめる</p>
          <p>③ まんなかのえが 3つそろったら あたり！</p>
        </div>

        {/* 報酬スタンプ数 */}
        <div className="mt-2 space-y-0.5 rounded-xl bg-orange-50 px-3 py-2">
          <p className="text-center text-[11px] font-bold text-orange-600">⭐ もらえるスタンプ ⭐</p>
          <div className="flex items-center justify-center gap-1 text-[11px]">
            {renderSymbol(TOOTH_SYMBOL, 13)}
            {renderSymbol(TOOTH_SYMBOL, 13)}
            {renderSymbol(TOOTH_SYMBOL, 13)}
            <span className="ml-0.5 text-gray-600">そろえると → <span className="font-bold text-orange-700">⭐8こ</span></span>
          </div>
          <p className="text-center text-[11px] text-gray-600">そのほか そろえると → <span className="font-bold text-orange-600">⭐5こ</span></p>
          <p className="text-center text-[11px] text-gray-400">はずれても <span className="font-bold text-orange-500">⭐1こ</span> もらえるよ！</p>
        </div>
      </div>
    </div>
  );
}
