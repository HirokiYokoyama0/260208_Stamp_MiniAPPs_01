'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, CreditCard, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ChildModeSettingsPage() {
  const router = useRouter();
  const [childId, setChildId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // 子供のプロフィール情報を取得
  useEffect(() => {
    const fetchChildProfile = async () => {
      try {
        const id = localStorage.getItem('currentChildId');
        if (!id) {
          throw new Error('子供IDが見つかりません');
        }
        setChildId(id);

        const res = await fetch(`/api/profiles/${id}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'プロフィールの取得に失敗しました');
        }

        // 代理管理メンバーは real_name を使用（優先）
        setDisplayName(data.profile.real_name || data.profile.display_name || '');
        setTicketNumber(data.profile.ticket_number || '');
      } catch (err) {
        console.error('プロフィール取得エラー:', err);
        setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchChildProfile();
  }, []);

  // 保存処理
  const handleSave = async () => {
    if (!childId) return;

    // バリデーション
    if (!displayName.trim()) {
      setError('なまえ を にゅうりょく してください');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      // Supabase で直接更新（代理管理メンバーは real_name に保存）
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),  // 検索用・互換性用
          real_name: displayName.trim(),     // 本名（実際の名前）
          ticket_number: ticketNumber.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', childId);

      if (updateError) {
        throw updateError;
      }

      setSuccessMessage('ほぞん しました！');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('保存エラー:', err);
      setError('ほぞん に しっぱい しました');
    } finally {
      setIsSaving(false);
    }
  };

  // 戻るボタン
  const handleBack = () => {
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-kids-pink via-kids-yellow to-kids-blue">
        <p className="text-white text-xl font-bold font-kids">よみこみちゅう...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-kids-pink via-kids-yellow to-kids-blue font-kids pb-24">
      {/* ヘッダー */}
      <div className="bg-white/90 backdrop-blur-sm shadow-lg">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft size={24} />
            <span className="text-lg font-bold">もどる</span>
          </button>
          <h1 className="flex-1 text-xl font-bold text-center text-gray-800">
            ⚙️ せってい
          </h1>
          <div className="w-16"></div> {/* バランス調整用 */}
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* エラーメッセージ */}
        {error && (
          <div className="bg-red-100 border-2 border-red-400 rounded-2xl p-4 text-center">
            <p className="text-red-700 font-bold">{error}</p>
          </div>
        )}

        {/* 成功メッセージ */}
        {successMessage && (
          <div className="bg-green-100 border-2 border-green-400 rounded-2xl p-4 text-center">
            <p className="text-green-700 font-bold">{successMessage}</p>
          </div>
        )}

        {/* 名前入力カード */}
        <div className="bg-white rounded-3xl shadow-xl p-6 border-4 border-kids-pink">
          <div className="flex items-center gap-2 mb-4">
            <User className="text-kids-pink" size={28} />
            <h2 className="text-xl font-bold text-gray-800">なまえ</h2>
          </div>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="なまえ を いれてね"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-lg focus:outline-none focus:border-kids-pink transition-colors"
          />
        </div>

        {/* 診察券番号入力カード */}
        <div className="bg-white rounded-3xl shadow-xl p-6 border-4 border-kids-blue">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="text-kids-blue" size={28} />
            <h2 className="text-xl font-bold text-gray-800">しんさつけんばんごう</h2>
          </div>
          <input
            type="text"
            value={ticketNumber}
            onChange={(e) => setTicketNumber(e.target.value)}
            placeholder="ばんごう を いれてね"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-lg focus:outline-none focus:border-kids-blue transition-colors"
          />
          <p className="text-sm text-gray-500 mt-2">
            ※ はいしゃさん で もらった かーど の ばんごう です
          </p>
        </div>

        {/* 保存ボタン */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-gradient-to-r from-kids-yellow to-kids-green text-white font-bold text-xl py-4 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              <span>ほぞんちゅう...</span>
            </>
          ) : (
            <>
              <Save size={24} />
              <span>ほぞん する</span>
            </>
          )}
        </button>

        {/* 説明カード */}
        <div className="bg-white/80 rounded-2xl p-4 border-2 border-kids-purple">
          <p className="text-sm text-gray-700 text-center">
            💡 なまえ と しんさつけんばんごう を<br />
            にゅうりょく して ほぞん してね！
          </p>
        </div>
      </div>
    </div>
  );
}
