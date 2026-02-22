'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useLiff } from '@/hooks/useLiff';
import type { ViewMode } from '@/types/viewMode';

interface ViewModeContextValue {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => Promise<void>;
  isLoading: boolean;
  selectedChildId: string | null;
  setSelectedChildId: (childId: string | null) => void;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>('adult');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChildId, setSelectedChildIdState] = useState<string | null>(null);
  const { profile } = useLiff();

  // ログイン時にDBからview_modeを取得、LocalStorageからselectedChildIdを読み込む
  useEffect(() => {
    const fetchViewMode = async () => {
      console.log('[ViewModeContext] fetchViewMode開始, profile?.userId:', profile?.userId);
      if (!profile?.userId) {
        console.log('[ViewModeContext] profile.userIdなし - isLoading=false');
        setIsLoading(false);
        return;
      }

      try {
        console.log('[ViewModeContext] Supabaseからview_mode取得中...');
        const { data, error } = await supabase
          .from('profiles')
          .select('view_mode')
          .eq('id', profile.userId)
          .single();

        console.log('[ViewModeContext] Supabaseレスポンス:', { data, error });

        if (!error && data?.view_mode) {
          console.log('[ViewModeContext] view_mode設定:', data.view_mode);
          setViewModeState(data.view_mode as ViewMode);
        }

        // LocalStorageからselectedChildIdを読み込む
        const storedChildId = localStorage.getItem('selectedChildId');
        if (storedChildId) {
          console.log('[ViewModeContext] selectedChildId読み込み:', storedChildId);
          setSelectedChildIdState(storedChildId);
        }
      } catch (err) {
        console.error('[ViewModeContext] view_mode取得エラー:', err);
      } finally {
        console.log('[ViewModeContext] fetchViewMode完了 - isLoading=false');
        setIsLoading(false);
      }
    };

    fetchViewMode();
  }, [profile?.userId]);

  // view_modeをDBに保存
  const setViewMode = useCallback(async (mode: ViewMode) => {
    if (!profile?.userId) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ view_mode: mode, updated_at: new Date().toISOString() })
        .eq('id', profile.userId);

      if (error) throw error;

      setViewModeState(mode);
      console.log(`view_modeを ${mode} に変更しました`);
    } catch (err) {
      console.error('view_mode保存エラー:', err);
    }
  }, [profile?.userId]);

  // selectedChildIdを設定（LocalStorageに保存）
  const setSelectedChildId = useCallback((childId: string | null) => {
    setSelectedChildIdState(childId);
    if (childId) {
      localStorage.setItem('selectedChildId', childId);
      console.log(`selectedChildIdを設定: ${childId}`);
    } else {
      localStorage.removeItem('selectedChildId');
      console.log('selectedChildIdをクリア');
    }
  }, []);

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode, isLoading, selectedChildId, setSelectedChildId }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export const useViewMode = () => {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error('useViewMode must be used within ViewModeProvider');
  }
  return context;
};
