"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useViewMode } from "@/contexts/ViewModeContext";

export default function KidsSlotButton() {
  const { viewMode } = useViewMode();
  const pathname = usePathname();

  if (viewMode !== "kids") return null;

  const isActive = pathname === "/slot";

  return (
    <Link
      href="/slot"
      className={`fixed bottom-[72px] left-4 z-20 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 ${
        isActive
          ? "bg-kids-pink ring-2 ring-kids-pink/50"
          : "bg-gradient-to-br from-kids-pink to-kids-purple"
      }`}
    >
      <span className="text-2xl">🎰</span>
    </Link>
  );
}
