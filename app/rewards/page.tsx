"use client";

import { useEffect, useState } from "react";
import { useLiff } from "@/hooks/useLiff";
import { Gift, CheckCircle2 } from "lucide-react";
import { fetchRewards, exchangeReward, addRewardStatus } from "@/lib/rewards";
import { fetchStampCount } from "@/lib/stamps";
import { RewardWithStatus } from "@/types/reward";

export default function RewardsPage() {
  const { isInitialized, isLoggedIn, isLoading, profile, login } = useLiff();
  const [rewards, setRewards] = useState<RewardWithStatus[]>([]);
  const [stampCount, setStampCount] = useState(0);
  const [isLoadingRewards, setIsLoadingRewards] = useState(true);
  const [isExchanging, setIsExchanging] = useState(false);

  // 特典一覧とスタンプ数を取得
  useEffect(() => {
    const loadData = async () => {
      if (!isLoggedIn || !profile?.userId) return;

      setIsLoadingRewards(true);
      try {
        // 並行して取得
        const [rewardsData, count] = await Promise.all([
          fetchRewards(),
          fetchStampCount(profile.userId),
        ]);

        setStampCount(count);
        setRewards(addRewardStatus(rewardsData, count));
      } catch (error) {
        console.error("❌ データ取得エラー:", error);
      } finally {
        setIsLoadingRewards(false);
      }
    };

    loadData();
  }, [isLoggedIn, profile]);

  // 特典交換処理
  const handleExchange = async (rewardId: string, rewardName: string) => {
    if (!profile?.userId) return;

    const confirmed = window.confirm(
      `「${rewardName}」と交換しますか？\n\n✨ スタンプは交換後も減りません\n\nこの操作は取り消せません。`
    );

    if (!confirmed) return;

    setIsExchanging(true);
    try {
      const result = await exchangeReward(profile.userId, rewardId);

      if (result.success) {
        alert(result.message);

        // スタンプ数を更新し、特典の状態を再計算
        const newCount = result.newStampCount ?? stampCount;
        setStampCount(newCount);
        setRewards((prev) => addRewardStatus(prev, newCount));
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error("❌ 特典交換エラー:", error);
      alert("エラーが発生しました");
    } finally {
      setIsExchanging(false);
    }
  };

  // ローディング中
  if (!isInitialized || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 未ログイン
  if (!isLoggedIn) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6">
        <p className="mb-6 text-center text-gray-600">
          LINEでログインして
          <br />
          特典をご利用ください
        </p>
        <button
          type="button"
          onClick={login}
          className="rounded-lg bg-[#06C755] px-8 py-3 font-medium text-white transition-colors hover:bg-[#05b04c]"
        >
          LINEでログイン
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-6">
      {/* ヘッダー */}
      <section className="rounded-xl border border-gray-100 bg-gradient-to-br from-primary/5 to-primary/10 p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <Gift size={24} className="text-primary-dark" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-800">
              特典交換ページ
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              貯まったスタンプで特典と交換できます
            </p>
            <p className="mt-1 text-xs text-primary-dark font-medium">
              ✨ スタンプは交換後も減りません
            </p>
          </div>
        </div>
      </section>

      {/* 現在のスタンプ数 */}
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="text-xs text-gray-500">現在のスタンプ数</p>
        <p className="mt-2 text-4xl font-bold text-primary">{stampCount}個</p>
      </section>

      {/* 特典一覧 */}
      <section>
        <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-gray-400">
          交換できる特典
        </h2>

        {isLoadingRewards ? (
          <div className="text-center text-sm text-gray-400">
            読み込み中...
          </div>
        ) : rewards.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-gray-500">特典がありません</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {rewards.map((reward) => (
              <li
                key={reward.id}
                className={`rounded-xl border bg-white p-5 shadow-sm transition-all ${
                  reward.canExchange
                    ? "border-primary/30 bg-primary/5"
                    : "border-gray-100"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* アイコン */}
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${
                      reward.canExchange
                        ? "bg-primary/20"
                        : "bg-gray-100"
                    }`}
                  >
                    {reward.canExchange ? (
                      <CheckCircle2
                        size={28}
                        className="text-primary"
                        strokeWidth={1.5}
                      />
                    ) : (
                      <Gift
                        size={28}
                        className="text-gray-400"
                        strokeWidth={1.5}
                      />
                    )}
                  </div>

                  {/* 特典情報 */}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {reward.name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {reward.description}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        {reward.required_stamps}個で交換
                      </span>
                      {!reward.canExchange && (
                        <span className="text-xs text-gray-500">
                          あと{reward.remainingStamps}個
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 交換ボタン */}
                <div className="mt-4">
                  {reward.canExchange ? (
                    <button
                      onClick={() => handleExchange(reward.id, reward.name)}
                      disabled={isExchanging}
                      className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isExchanging ? "交換中..." : "この特典と交換する"}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full cursor-not-allowed rounded-lg bg-gray-100 px-4 py-3 text-sm font-medium text-gray-400"
                    >
                      スタンプが不足しています
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
