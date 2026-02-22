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
  isFriend: boolean | null;
  checkFriendship: () => Promise<void>;
  login: () => void;
  logout: () => void;
}

export function useLiff(): UseLiffReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [isFriend, setIsFriend] = useState<boolean | null>(null);

  // 友だち状態チェック関数（依存関係なし）
  const checkFriendship = useCallback(async () => {
    if (!liff.isLoggedIn()) {
      setIsFriend(null);
      return;
    }

    try {
      const friendship = await liff.getFriendship();
      setIsFriend(friendship.friendFlag);

      // Supabaseに友だち登録状態を保存（キャッシュ）
      // profileDataを取得し直す
      try {
        const profileData = await liff.getProfile();
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        await supabase
          .from("profiles")
          .update({ is_line_friend: friendship.friendFlag })
          .eq("id", profileData.userId);
      } catch (dbError) {
        console.warn("Supabaseへの友だち状態保存に失敗しました:", dbError);
        // エラーでも処理は続行（キャッシュなので失敗しても問題なし）
      }
    } catch (err) {
      console.error("友だち状態の取得に失敗しました:", err);
      setIsFriend(null);
    }
  }, []); // 依存関係を空にする

  // LIFF初期化（一度だけ実行）
  useEffect(() => {
    let mounted = true;

    const initLiff = async () => {
      console.log('[useLiff] 初期化開始');
      if (typeof window === "undefined") {
        console.log('[useLiff] サーバーサイドのため初期化スキップ');
        return;
      }
      if (!LIFF_ID) {
        console.error('[useLiff] LIFF_IDが設定されていません');
        setError(new Error("NEXT_PUBLIC_LIFF_ID is not set"));
        setIsLoading(false);
        return;
      }

      console.log('[useLiff] LIFF_ID:', LIFF_ID);

      try {
        console.log('[useLiff] liff.init() 実行中...');
        await liff.init({ liffId: LIFF_ID });
        if (!mounted) return;

        console.log('[useLiff] liff.init() 完了');
        setIsInitialized(true);

        if (liff.isLoggedIn()) {
          console.log('[useLiff] ログイン済み - プロフィール取得中...');
          setIsLoggedIn(true);
          const profileData = await liff.getProfile();
          if (!mounted) return;

          console.log('[useLiff] プロフィール取得完了:', profileData);

          setProfile({
            userId: profileData.userId,
            displayName: profileData.displayName ?? "",
            pictureUrl: profileData.pictureUrl,
            statusMessage: profileData.statusMessage,
          });

          // 友だち状態をチェック
          console.log('[useLiff] 友だち状態チェック中...');
          await checkFriendship();
          console.log('[useLiff] 友だち状態チェック完了');
        } else {
          console.log('[useLiff] 未ログイン');
          setIsLoggedIn(false);
        }
      } catch (err) {
        console.error('[useLiff] エラー発生:', err);
        if (!mounted) return;
        setError(err instanceof Error ? err : new Error("LIFF init failed"));
        setIsInitialized(false);
      } finally {
        if (mounted) {
          console.log('[useLiff] 初期化完了 - isLoading=false');
          setIsLoading(false);
        }
      }
    };

    initLiff();

    return () => {
      mounted = false;
    };
  }, []); // 依存関係を空にして一度だけ実行

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
    isFriend,
    checkFriendship,
    login,
    logout,
  };
}
