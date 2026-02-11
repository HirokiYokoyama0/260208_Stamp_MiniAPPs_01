"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  Stamp,
  Gift,
  ClipboardCheck,
  Building2,
} from "lucide-react";
import { useLiff } from "@/hooks/useLiff";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import FriendshipPromptModal from "@/components/features/FriendshipPromptModal";

const TABS = [
  { href: "/", label: "診察券", icon: CreditCard },
  { href: "/stamp", label: "スタンプ", icon: Stamp },
  { href: "/rewards", label: "特典", icon: Gift },
  { href: "/care", label: "ケア記録", icon: ClipboardCheck },
  { href: "/info", label: "医院情報", icon: Building2 },
] as const;

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState(pathname);
  const { isLoggedIn, isLoading, isFriend } = useLiff();
  const [showFriendshipModal, setShowFriendshipModal] = useState(false);
  const [hasShownModal, setHasShownModal] = useState(false);

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

        {/* ボトムナビゲーション */}
        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-100 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-around px-1 py-2">
            {TABS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setActiveTab(href)}
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
      </div>
    </ViewModeProvider>
  );
}
