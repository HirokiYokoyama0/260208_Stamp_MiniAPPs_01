"use client";

import { useEffect, useState } from "react";
import { useLiff } from "@/hooks/useLiff";
import { QRScanner } from "@/components/shared/QRScanner";
import { CheckCircle2, Trophy } from "lucide-react";
import {
  fetchStampCount,
  fetchStampHistory,
  addStamp,
  formatStampDate,
  getStampProgress,
} from "@/lib/stamps";
import { StampHistoryRecord } from "@/types/stamp";

const STAMP_GOAL = 10; // ごほうび交換に必要なスタンプ数

export default function AdultStampPage() {
  const { isLoggedIn, profile } = useLiff();
  const [stampCount, setStampCount] = useState(0);
  const [stampHistory, setStampHistory] = useState<StampHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  // スタンプ履歴とカウント数を取得
  const fetchHistory = async () => {
    if (!profile?.userId) return;

    setIsLoading(true);
    try {
      // スタンプ数は profiles.stamp_count から取得（Single Source of Truth）
      const count = await fetchStampCount(profile.userId);
      setStampCount(count);

      // 履歴は stamp_history から取得
      const history = await fetchStampHistory(profile.userId);
      setStampHistory(history);
    } catch (error) {
      console.error("❌ スタンプ履歴の取得エラー:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 初回ロード時にスタンプ履歴を取得
  useEffect(() => {
    if (isLoggedIn && profile) {
      fetchHistory();
    }
  }, [isLoggedIn, profile]);

  // QRスキャン時の処理
  const handleStampScan = async (qrValue: string) => {
    if (!profile?.userId) {
      alert("ログインしてください");
      return;
    }

    setIsScanning(true);
    try {
      const result = await addStamp(profile.userId, qrValue);
      if (result.success) {
        // 成功時
        console.log("✅ スタンプを付与しました:", result);
        setStampCount(result.stampCount || stampCount + 1);
        // 履歴を再取得して画面更新
        await fetchHistory();
        alert(`スタンプを取得しました！\n現在 ${result.stampCount} / ${STAMP_GOAL}個`);
      } else {
        // エラー表示
        console.error("❌ スタンプ付与失敗:", result.error);
        alert(result.message || "スタンプの登録に失敗しました");
      }
    } catch (error) {
      console.error("❌ スタンプ登録エラー:", error);
      alert("エラーが発生しました");
    } finally {
      setIsScanning(false);
    }
  };

  // スタンプ進捗を計算
  const progress = getStampProgress(stampCount, STAMP_GOAL);

  return (
    <div className="space-y-6 px-4 py-6">
      {/* スタンプカウンターセクション */}
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400">
            現在のスタンプ数
          </h2>
          <p className="text-xs text-gray-500">
            訪問回数: {stampHistory.length}回
          </p>
        </div>
        <div className="mt-4 flex items-center justify-center">
          <div className="text-center">
            <p className="text-5xl font-bold text-primary">{stampCount}</p>
            <p className="mt-2 text-sm text-gray-500">/ {STAMP_GOAL}個</p>
          </div>
        </div>
        {/* プログレスバー */}
        <div className="mt-6 h-3 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary-dark transition-all duration-500"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
        <p className="mt-3 text-center text-xs text-gray-500">
          {progress.isComplete ? (
            <span className="flex items-center justify-center gap-1 font-semibold text-accent">
              <Trophy size={14} />
              ごほうび交換可能です！
            </span>
          ) : (
            `あと${progress.remaining}個でごほうび交換可能です`
          )}
        </p>
      </section>

      {/* QRスキャンボタン */}
      <QRScanner
        onScan={handleStampScan}
        onError={(err) => console.error("QRスキャンエラー:", err)}
        disabled={isScanning}
        className="w-full"
      >
        {isScanning ? "読み取り中..." : "来院スタンプを読み取る"}
      </QRScanner>

      {/* 来院履歴リスト */}
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-gray-400">
          来院履歴
        </h2>
        {isLoading ? (
          <p className="text-sm text-gray-400">読み込み中...</p>
        ) : stampHistory.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-400">まだスタンプがありません</p>
            <p className="mt-2 text-xs text-gray-400">
              QRコードを読み取ってスタンプを獲得しましょう！
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {stampHistory.map((record, index) => {
              const visitNumber = stampHistory.length - index; // 訪問回数（最新が1番目）
              return (
                <li
                  key={record.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/30 p-3 transition-colors hover:bg-gray-50"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">
                      {visitNumber}回目の来院
                      {record.stamp_method === 'manual_admin' && (
                        <span className="ml-2 text-xs text-gray-500">(スタッフ編集)</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatStampDate(record.visit_date)} • スタンプ {record.stamp_number}個
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
