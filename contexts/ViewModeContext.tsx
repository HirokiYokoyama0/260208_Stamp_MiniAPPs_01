'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useLiff } from '@/hooks/useLiff';
import type { ViewMode } from '@/types/viewMode';

interface ViewModeContextValue {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => Promise<void>;
  isLoading: boolean;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>('adult');
  const [isLoading, setIsLoading] = useState(true);
  const { profile } = useLiff();

  // ログイン時にDBからview_modeを取得
  useEffect(() => {
    const fetchViewMode = async () => {
      if (!profile?.userId) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('view_mode')
          .eq('id', profile.userId)
          .single();

        if (!error && data?.view_mode) {
          setViewModeState(data.view_mode as ViewMode);
        }
      } catch (err) {
        console.error('view_mode取得エラー:', err);
      } finally {
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

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode, isLoading }}>
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
