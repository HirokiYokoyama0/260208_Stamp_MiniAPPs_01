"use client";

import { useState, useEffect, useCallback } from "react";
import liff from "@line/liff";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? "";

export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface UseLiffReturn {
  isInitialized: boolean;
  isLoggedIn: boolean;
  isLoading: boolean;
  error: Error | null;
  profile: LiffProfile | null;
  login: () => void;
  logout: () => void;
}

export function useLiff(): UseLiffReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [profile, setProfile] = useState<LiffProfile | null>(null);

  const initLiff = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!LIFF_ID) {
      setError(new Error("NEXT_PUBLIC_LIFF_ID is not set"));
      setIsLoading(false);
      return;
    }

    try {
      await liff.init({ liffId: LIFF_ID });
      setIsInitialized(true);

      if (liff.isLoggedIn()) {
        setIsLoggedIn(true);
        const profileData = await liff.getProfile();
        setProfile({
          userId: profileData.userId,
          displayName: profileData.displayName ?? "",
          pictureUrl: profileData.pictureUrl,
          statusMessage: profileData.statusMessage,
        });
      } else {
        setIsLoggedIn(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("LIFF init failed"));
      setIsInitialized(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initLiff();
  }, [initLiff]);

  const login = useCallback(() => {
    if (!liff.isLoggedIn()) {
      liff.login();
    }
  }, []);

  const logout = useCallback(() => {
    if (liff.isLoggedIn()) {
      liff.logout();
    }
  }, []);

  return {
    isInitialized,
    isLoggedIn,
    isLoading,
    error,
    profile,
    login,
    logout,
  };
}
