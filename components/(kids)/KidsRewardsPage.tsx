"use client";

import { useViewMode } from "@/contexts/ViewModeContext";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * 子供用特典ページ
 * Phase 2で別の開発者が実装予定
 *
 * デザイン要件:
 * - 特典にキャラクターイラスト付き
 * - 子供向けの名称（例：「ピカピカはみがきごほうび」）
 * - カラフルなカード型デザイン
 * - 交換ボタンが大きくてわかりやすい
 */
export default function KidsRewardsPage() {
  const { viewMode, setSelectedChildId, setViewMode } = useViewMode();
  const router = useRouter();

  // 親の画面に戻る
  const handleBackToParent = async () => {
    setSelectedChildId(null);
    await setViewMode('adult');
    router.push('/');
  };

  return (
    <div className="min-h-screen px-4 py-6 font-kids bg-gradient-to-b from-purple-100 via-blue-50 to-sky-100">
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
      <div className="rounded-xl bg-white/80 p-6 text-center">
        <p className="text-4xl">🎁</p>
        <h2 className="mt-4 text-xl font-bold text-kids-purple">
          ごほうび
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          （じゅんびちゅう）
        </p>
      </div>
    </div>
  );
}
