"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  Stamp,
  Gift,
  ClipboardCheck,
  Building2,
} from "lucide-react";

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

  return (
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
  );
}
