"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useLiff } from "@/hooks/useLiff";
import { supabase } from "@/lib/supabase";

export default function KidsSlotButton() {
  const { viewMode, selectedChildId } = useViewMode();
  const { profile } = useLiff();
  const pathname = usePathname();
  const [slotUnlocked, setSlotUnlocked] = useState(false);

  useEffect(() => {
    const checkUnlock = async () => {
      const userId = selectedChildId ?? profile?.userId;
      if (!userId) return;

      try {
        const now = new Date();
        const jstOffset = 9 * 60 * 60 * 1000;
        const jstNow = new Date(now.getTime() + jstOffset);
        const todayStart = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());
        const todayStartUTC = new Date(todayStart.getTime() - jstOffset).toISOString();

        const { data } = await supabase
          .from("event_logs")
          .select("id")
          .eq("user_id", userId)
          .eq("event_name", "slot_unlock")
          .gte("created_at", todayStartUTC)
          .limit(1);

        setSlotUnlocked(data !== null && data.length > 0);
      } catch {
        // ignore
      }
    };

    checkUnlock();
  }, [selectedChildId, profile?.userId]);

  if (viewMode !== "kids") return null;
  if (!slotUnlocked) return null;

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
