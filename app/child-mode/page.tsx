'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import KidsHome from '@/components/(kids)/KidsHome';

interface Profile {
  id: string;
  display_name: string;
  ticket_number: string | null;
  stamp_count: number;
  total_rewards_redeemed: number;
  last_stamp_at: string | null;
  family_id: string | null;
  family_role: 'parent' | 'child' | null;
  view_mode: 'adult' | 'kids';
  next_visit_date: string | null;
  next_memo: string | null;
}

export default function ChildModePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchChildProfile = async () => {
      try {
        // LocalStorageから子供のIDを取得（ViewModeContextと同じキー名を使用）
        const childId = localStorage.getItem('selectedChildId');

        if (!childId) {
          throw new Error('子供IDが見つかりません');
        }

        // プロフィールを取得
        const res = await fetch(`/api/profiles/${childId}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'プロフィールの取得に失敗しました');
        }

        setProfile(data.profile);
      } catch (err) {
        console.error('子供プロフィール取得エラー:', err);
        setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchChildProfile();
  }, []);

  const handleBack = () => {
    // LocalStorageをクリア（ViewModeContextと同じキー名を使用）
    localStorage.removeItem('selectedChildId');
    router.push('/family/manage');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-kids-pink via-kids-yellow to-kids-blue">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-white mx-auto mb-4" />
          <p className="text-white text-xl font-bold">よみこみちゅう...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-kids-pink via-kids-yellow to-kids-blue px-4">
        <div className="bg-white rounded-3xl p-8 text-center shadow-2xl max-w-md">
          <p className="text-gray-800 text-lg mb-6">{error || 'プロフィールが見つかりません'}</p>
          <button
            onClick={handleBack}
            className="px-6 py-3 bg-kids-pink text-white rounded-full font-bold text-lg hover:bg-kids-pink/90 transition-colors"
          >
            もどる
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 戻るボタン（絶対位置） */}
      <button
        onClick={handleBack}
        className="fixed top-4 left-4 z-50 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg hover:bg-white transition-all text-gray-700 font-medium"
      >
        <ArrowLeft size={20} />
        <span className="text-sm">かぞくかんりにもどる</span>
      </button>

      {/* 子供モード（KidsHomeを再利用） */}
      <KidsHome profileOverride={profile} />
    </div>
  );
}
