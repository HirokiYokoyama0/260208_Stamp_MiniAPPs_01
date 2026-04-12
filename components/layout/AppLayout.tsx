"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  Stamp,
  Gift,
  ClipboardCheck,
  Building2,
  Settings,
} from "lucide-react";
import liff from "@line/liff";
import { useLiff } from "@/hooks/useLiff";
import { ViewModeProvider, useViewMode } from "@/contexts/ViewModeContext";
import FriendshipPromptModal from "@/components/features/FriendshipPromptModal";
import SurveyModal from "@/components/survey/SurveyModal";
// KidsSlotButtonはスタンプタブに統合済み
import { logAppOpen } from "@/lib/analytics";
import { ExternalBrowserWarning } from "@/components/ExternalBrowserWarning";

const TABS = [
  { href: "/", label: "会員証", icon: CreditCard, kidsHref: undefined, kidsDisabled: false },
  { href: "/stamp", label: "スタンプ", icon: Stamp, kidsHref: undefined, kidsDisabled: false },
  { href: "/rewards", label: "特典", icon: Gift, kidsHref: undefined, kidsDisabled: false },
  { href: "/care", label: "ケア記録", icon: ClipboardCheck, kidsHref: undefined, kidsDisabled: false },
  { href: "/info", label: "医院情報", icon: Building2, kidsHref: undefined, kidsDisabled: false },
  { href: "/settings", label: "設定", icon: Settings, kidsHref: "/child-mode/settings", kidsDisabled: false },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

// ボトムナビゲーションコンポーネント（ViewMode対応）
function BottomNavigation() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState(pathname);
  const { viewMode, selectedChildId } = useViewMode();
  const isKidsMode = viewMode === 'kids' && selectedChildId !== null;

  // ケア記録タブのロック状態管理
  const [isCareUnlockedAdult, setIsCareUnlockedAdult] = useState(false);
  const [isCareUnlockedKids, setIsCareUnlockedKids] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [pressProgress, setPressProgress] = useState(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // LocalStorageからロック状態を復元
  useEffect(() => {
    const adultUnlocked = localStorage.getItem('care_unlocked_adult') === 'true';
    const kidsUnlocked = localStorage.getItem('care_unlocked_kids') === 'true';
    setIsCareUnlockedAdult(adultUnlocked);
    setIsCareUnlockedKids(kidsUnlocked);
  }, []);

  // 3秒長押し開始
  const handleCareTabPressStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setPressProgress(0);

    // プログレス更新（30回/秒 = 3秒で100%）
    progressIntervalRef.current = setInterval(() => {
      setPressProgress((prev) => {
        if (prev >= 100) {
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          return 100;
        }
        return prev + (100 / 90); // 3000ms / (1000ms/30) = 90ステップ
      });
    }, 33); // 約30fps

    // 3秒後にアンロック
    pressTimerRef.current = setTimeout(() => {
      if (isKidsMode) {
        setIsCareUnlockedKids(true);
        localStorage.setItem('care_unlocked_kids', 'true');
        console.log('[AppLayout] キッズモード: ケア記録タブをアンロック');
      } else {
        setIsCareUnlockedAdult(true);
        localStorage.setItem('care_unlocked_adult', 'true');
        console.log('[AppLayout] 大人モード: ケア記録タブをアンロック');
      }
      setPressProgress(0);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }, 3000);
  };

  // 長押し中断
  const handleCareTabPressEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setPressProgress(0);
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-100 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around px-1 py-2">
        {TABS.map(({ href, label, icon: Icon, kidsHref, kidsDisabled }) => {
          // 子供モードかつkidsHrefが設定されている場合は専用リンクを使用
          const actualHref = isKidsMode && kidsHref ? kidsHref : href;
          const isActive = pathname === actualHref || (actualHref !== "/" && pathname.startsWith(actualHref));

          // ケア記録タブの特別処理
          const isCareTab = href === "/care";
          const isCareUnlocked = isKidsMode ? isCareUnlockedKids : isCareUnlockedAdult;
          const isLocked = isCareTab && !isCareUnlocked;

          // ロック中のケア記録タブ
          if (isLocked) {
            return (
              <div
                key={href}
                className="relative flex flex-1 flex-col items-center gap-1 px-2 py-2 opacity-35 cursor-pointer text-gray-400"
                onMouseDown={handleCareTabPressStart}
                onMouseUp={handleCareTabPressEnd}
                onMouseLeave={handleCareTabPressEnd}
                onTouchStart={handleCareTabPressStart}
                onTouchEnd={handleCareTabPressEnd}
                onTouchCancel={handleCareTabPressEnd}
              >
                <Icon size={20} strokeWidth={1.8} />
                <span className="text-[10px] font-medium leading-tight">{label}</span>

                {/* プログレスバー */}
                {pressProgress > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-100"
                      style={{ width: `${pressProgress}%` }}
                    />
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={href}
              href={actualHref}
              onClick={() => setActiveTab(actualHref)}
              className={`flex flex-1 flex-col items-center gap-1 px-2 py-2 transition-colors ${
                isActive
                  ? "text-primary-dark"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon
                size={20}
                strokeWidth={isActive ? 2.5 : 1.8}
                className={isActive ? "text-primary" : ""}
              />
              <span className="text-[10px] font-medium leading-tight">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isLoggedIn, isLoading, isFriend, profile } = useLiff();
  const [showFriendshipModal, setShowFriendshipModal] = useState(false);
  const [hasShownModal, setHasShownModal] = useState(false);

  // 🆕 外部ブラウザ判定
  const [isExternalBrowser, setIsExternalBrowser] = useState(false);
  const [isLiffChecked, setIsLiffChecked] = useState(false);
  const [allowExternalBrowser, setAllowExternalBrowser] = useState(false);

  // アンケートモーダル関連のstate
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyData, setSurveyData] = useState<{
    surveyId: string;
    title: string;
    description?: string;
  } | null>(null);

  // 🆕 外部ブラウザチェック（LIFF初期化＆ログイン完了後に実行）
  useEffect(() => {
    // isLoading=false かつ isLoggedIn=true になったらチェック（認証フロー完了後）
    if (!isLoading && isLoggedIn && !isLiffChecked) {
      try {
        // LINEアプリ内で開いているかチェック
        if (!liff.isInClient()) {
          console.warn("⚠️ [AppLayout] 外部ブラウザで開かれています");
          setIsExternalBrowser(true);
        } else {
          console.log("✅ [AppLayout] LINEアプリ内で開かれています");
          setIsExternalBrowser(false);
        }
      } catch (error) {
        console.error("❌ [AppLayout] LIFF判定エラー:", error);
        // エラーの場合は通常通り表示（安全策）
        setIsExternalBrowser(false);
      }
      setIsLiffChecked(true);
    }
  }, [isLoading, isLoggedIn, isLiffChecked]);

  // アプリ起動ログ
  useEffect(() => {
    if (isLoggedIn && profile) {
      logAppOpen({ userId: profile.userId });
    }
  }, [isLoggedIn, profile]);

  // アンケートモーダル表示チェック
  useEffect(() => {
    if (!isLoggedIn || !profile || isLoading) return;

    const checkPendingSurvey = async () => {
      try {
        const res = await fetch('/api/survey/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: profile.userId }),
        });

        const data = await res.json();

        if (data.shouldShow && data.surveyId) {
          // 友だち登録モーダルの後に表示（優先度を考慮）
          setTimeout(() => {
            setSurveyData({
              surveyId: data.surveyId,
              title: data.surveyTitle || 'アンケート',
              description: data.surveyDescription,
            });
            setShowSurveyModal(true);
          }, showFriendshipModal ? 3000 : 1500); // 友だちモーダル表示中なら遅延
        }
      } catch (error) {
        console.error('アンケートチェックエラー:', error);
      }
    };

    checkPendingSurvey();
  }, [isLoggedIn, profile, isLoading, showFriendshipModal]);

  // 初回起動時に友だち登録を促進
  useEffect(() => {
    // すでにモーダルを表示済み、またはローディング中はスキップ
    if (hasShownModal || isLoading) return;

    // isFriendがnullの場合（まだ確認中）はスキップ
    if (isFriend === null) return;

    // ログイン済みで、友だち登録がfalseの場合にモーダル表示
    if (isLoggedIn && isFriend === false) {
      // LocalStorageで「今日すでに表示したか」をチェック（1日1回まで）
      const today = new Date().toISOString().split("T")[0];
      const lastShown = localStorage.getItem("friendshipPromptLastShown");

      if (lastShown !== today) {
        // 少し遅延させてから表示（UX改善）
        const timer = setTimeout(() => {
          setShowFriendshipModal(true);
          setHasShownModal(true);
          localStorage.setItem("friendshipPromptLastShown", today);
        }, 2000);

        return () => clearTimeout(timer);
      } else {
        setHasShownModal(true);
      }
    } else if (isLoggedIn && isFriend === true) {
      // 友だち登録済みの場合はフラグを立てる
      setHasShownModal(true);
    }
  }, [isLoggedIn, isLoading, isFriend, hasShownModal]);

  const handleCloseFriendshipModal = () => {
    setShowFriendshipModal(false);
  };

  const handleConfirmFriendship = () => {
    setShowFriendshipModal(false);
    // 公式アカウントページへのリダイレクトはモーダル内で処理
  };

  const handleCloseSurveyModal = () => {
    setShowSurveyModal(false);
  };

  const handlePostponeSurvey = async () => {
    if (!profile || !surveyData) return;

    try {
      await fetch('/api/survey/postpone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.userId,
          surveyId: surveyData.surveyId,
        }),
      });
      setShowSurveyModal(false);
    } catch (error) {
      console.error('アンケート後回しエラー:', error);
      setShowSurveyModal(false);
    }
  };

  // 🆕 外部ブラウザで開かれている場合、誘導画面を表示
  if (isLiffChecked && isExternalBrowser && !allowExternalBrowser) {
    return <ExternalBrowserWarning onContinue={() => setAllowExternalBrowser(true)} />;
  }

  return (
    <ViewModeProvider>
      <div className="flex min-h-screen flex-col bg-white">
        {/* ヘッダー: つくばホワイト歯科 ロゴ */}
        <header className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-center">
            <h1 className="text-lg font-semibold tracking-wide text-gray-800">
              つくばホワイト歯科
            </h1>
          </div>
        </header>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-auto pb-20">{children}</main>

        {/* 友だち登録促進モーダル */}
        <FriendshipPromptModal
          isOpen={showFriendshipModal}
          onClose={handleCloseFriendshipModal}
          onConfirm={handleConfirmFriendship}
        />

        {/* アンケートモーダル */}
        {surveyData && (
          <SurveyModal
            isOpen={showSurveyModal}
            surveyId={surveyData.surveyId}
            title={surveyData.title}
            description={surveyData.description}
            onClose={handleCloseSurveyModal}
            onPostpone={handlePostponeSurvey}
          />
        )}

        {/* ボトムナビゲーション */}
        <BottomNavigation />
      </div>
    </ViewModeProvider>
  );
}
