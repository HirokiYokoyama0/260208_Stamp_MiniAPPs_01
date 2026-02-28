'use client';

import { useViewMode } from '@/contexts/ViewModeContext';
import { useLiff } from '@/hooks/useLiff';
import { Baby, Users, Heart, CheckCircle2, ExternalLink, User, Edit3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logChildModeEnter } from '@/lib/analytics';

const OFFICIAL_ACCOUNT_URL = "https://line.me/R/ti/p/@550mlcao";

interface ProxyChild {
  id: string;
  display_name: string;
  real_name: string | null;
  stamp_count: number;
}

export default function SettingsPage() {
  const { viewMode, setViewMode, isLoading: viewModeLoading, setSelectedChildId, selectedChildId } = useViewMode();
  const { profile, isFriend, isLoading } = useLiff();
  const router = useRouter();
  const [familyRole, setFamilyRole] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [proxyChildren, setProxyChildren] = useState<ProxyChild[]>([]);
  const [realName, setRealName] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editRealName, setEditRealName] = useState('');
  const [editTicketNumber, setEditTicketNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // キッズモードの場合は子供用設定画面にリダイレクト
  useEffect(() => {
    if (!viewModeLoading && viewMode === 'kids' && selectedChildId) {
      console.log('[Settings] キッズモード検出 → /child-mode/settings にリダイレクト');
      router.replace('/child-mode/settings');
    }
  }, [viewMode, selectedChildId, viewModeLoading, router]);

  // ユーザーの家族ロールと代理管理メンバーを取得
  useEffect(() => {
    const fetchUserRoleAndProxyChildren = async () => {
      if (!profile?.userId) return;

      try {
        const res = await fetch(`/api/users/me?userId=${profile.userId}`);
        const data = await res.json();
        if (data.success && data.profile) {
          setFamilyRole(data.profile.family_role);
          setFamilyId(data.profile.family_id);
          setRealName(data.profile.real_name);
          setTicketNumber(data.profile.ticket_number);

          // 親の場合、代理管理メンバーを取得
          if (data.profile.family_role === 'parent' && data.profile.family_id) {
            console.log('[Settings] 親ユーザー検出、家族情報を取得中...');
            const familyRes = await fetch(`/api/families/me?userId=${profile.userId}`);
            const familyData = await familyRes.json();
            console.log('[Settings] 家族情報レスポンス:', familyData);

            if (familyData.success && familyData.family?.members) {
              console.log('[Settings] 全メンバー:', familyData.family.members);
              // line_user_id が NULL のメンバーを代理管理メンバーとして抽出
              const proxyMembers = familyData.family.members.filter(
                (member: any) => member.line_user_id === null
              );
              console.log('[Settings] 代理管理メンバー:', proxyMembers);
              setProxyChildren(proxyMembers);
            }
          }
        }
      } catch (err) {
        console.error('ユーザー情報取得エラー:', err);
      }
    };

    fetchUserRoleAndProxyChildren();
  }, [profile?.userId]);

  const handleFamilyManage = () => {
    if (familyRole === 'parent' && familyId) {
      // 親で家族に参加済み → 家族管理画面
      router.push('/family/manage');
    } else if (familyRole === 'child' && familyId) {
      // 子で家族に参加済み → 家族情報画面（将来実装、今は家族管理画面）
      router.push('/family/manage');
    } else {
      // 家族に未参加 → 招待コード入力画面
      router.push('/family/join');
    }
  };

  const handleAddFriend = () => {
    window.open(OFFICIAL_ACCOUNT_URL, "_blank");
  };

  const handleSwitchToChild = async (childId: string) => {
    console.log('[Settings] 子供の画面に切り替え:', childId);

    // 子供の情報を取得
    const child = proxyChildren.find(c => c.id === childId);
    const childName = child?.real_name || child?.display_name || '不明';

    // イベントログ記録
    if (profile?.userId) {
      await logChildModeEnter({
        userId: profile.userId,
        childId: childId,
        childName: childName,
      });
    }

    // Contextとローカルストレージに selectedChildId を保存
    setSelectedChildId(childId);

    // キッズモードに切り替え
    await setViewMode('kids');

    // ホーム画面にリダイレクト
    router.push('/');
  };

  const handleEditProfile = () => {
    setEditRealName(realName || '');
    setEditTicketNumber(ticketNumber || '');
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!profile?.userId) return;

    // バリデーション
    if (!editRealName.trim()) {
      alert('お名前を入力してください');
      return;
    }

    if (!editTicketNumber.trim()) {
      alert('診察券番号を入力してください');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          real_name: editRealName.trim(),
          ticket_number: editTicketNumber.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.userId);

      if (error) {
        console.error('プロフィール更新エラー:', error);
        alert('更新に失敗しました');
        return;
      }

      // ローカル状態を更新
      setRealName(editRealName.trim());
      setTicketNumber(editTicketNumber.trim());
      setIsEditingProfile(false);
      alert('プロフィールを更新しました');
    } catch (err) {
      console.error('プロフィール更新エラー:', err);
      alert('更新に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // デバッグログ
  console.log('[Settings Render] familyRole:', familyRole);
  console.log('[Settings Render] proxyChildren:', proxyChildren);
  console.log('[Settings Render] proxyChildren.length:', proxyChildren.length);
  console.log('[Settings Render] 条件判定:', {
    isFamilyRoleParent: familyRole === 'parent',
    hasProxyChildren: proxyChildren.length > 0,
    shouldShowSection: familyRole === 'parent' && proxyChildren.length > 0,
  });

  return (
    <div className="px-4 py-6">
      <h2 className="mb-6 text-lg font-semibold text-gray-800">設定</h2>

      {/* プロフィール情報セクション */}
      <section className="mb-6">
        <h3 className="mb-3 text-sm font-medium text-gray-700">プロフィール情報</h3>
        <div className="rounded-lg border-2 border-gray-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="text-primary" size={20} />
              <h4 className="font-semibold text-gray-800">患者情報</h4>
            </div>
            {!isEditingProfile && (
              <button
                onClick={handleEditProfile}
                className="flex items-center gap-1 text-sm text-primary hover:text-primary-dark"
              >
                <Edit3 size={16} />
                編集
              </button>
            )}
          </div>

          {isEditingProfile ? (
            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  お名前（本名） <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editRealName}
                  onChange={(e) => setEditRealName(e.target.value)}
                  placeholder="例: 山田 太郎"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  診察券番号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editTicketNumber}
                  onChange={(e) => setEditTicketNumber(e.target.value)}
                  placeholder="例: 123456"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  disabled={isSaving}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsEditingProfile(false)}
                  disabled={isSaving}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex-1 rounded-lg bg-primary px-4 py-2.5 font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                >
                  {isSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">お名前</span>
                <span className="font-medium text-gray-800">
                  {realName || '未設定'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">診察券番号</span>
                <span className="font-medium font-mono text-gray-800">
                  {ticketNumber || '未登録'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">LINE表示名</span>
                <span className="text-sm text-gray-500">
                  {profile?.displayName}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 公式LINE友だち登録セクション */}
      <section className="mb-6">
        <h3 className="mb-3 text-sm font-medium text-gray-700">公式LINE</h3>
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Heart className="text-primary" size={20} />
            <h4 className="font-semibold text-gray-800">公式LINEアカウント</h4>
          </div>

          {isLoading || isFriend === null ? (
            <p className="text-sm text-gray-500">確認中...</p>
          ) : isFriend === true ? (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 size={18} />
              <span className="font-medium">友だち登録済みです</span>
            </div>
          ) : (
            <div>
              <p className="mb-3 text-sm text-gray-700">
                公式LINEを友だち登録すると、以下の通知を受け取れます：
              </p>
              <ul className="mb-4 space-y-1 text-sm text-gray-600">
                <li>• 定期検診のリマインド</li>
                <li>• キャンペーン情報</li>
                <li>• 特典交換のお知らせ</li>
                <li>• 休診日のお知らせ</li>
              </ul>
              <button
                onClick={handleAddFriend}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#06C755] px-4 py-3 font-semibold text-white transition-colors hover:bg-[#05b34b]"
              >
                <Heart size={18} />
                友だち追加する
                <ExternalLink size={16} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 家族管理セクション */}
      <section className="mt-8">
        <h3 className="mb-3 text-sm font-medium text-gray-700">家族管理</h3>
        <button
          onClick={handleFamilyManage}
          className="flex w-full items-center gap-4 rounded-lg border-2 border-gray-200 p-4 transition-all hover:border-primary hover:bg-primary/5"
        >
          <Users size={32} className="text-primary" />
          <div className="flex-1 text-left">
            <p className="font-semibold text-gray-800">
              {familyRole === 'parent' && '家族の管理'}
              {familyRole === 'child' && familyId && '家族情報'}
              {(!familyRole || !familyId) && '家族に参加'}
            </p>
            <p className="text-xs text-gray-500">
              {familyRole === 'parent' && '家族メンバーの管理や招待コードの確認'}
              {familyRole === 'child' && familyId && '家族情報を確認'}
              {(!familyRole || !familyId) && '招待コードで家族グループに参加しよう'}
            </p>
          </div>
          <span className="text-gray-400">→</span>
        </button>
      </section>

      {/* 子供の画面切替セクション（代理管理メンバーがいる場合のみ表示） */}
      {familyRole === 'parent' && proxyChildren.length > 0 && (
        <section className="mt-8">
          <h3 className="mb-3 text-sm font-medium text-gray-700">子供の画面</h3>
          <div className="space-y-3">
            {proxyChildren.map((child) => (
              <button
                key={child.id}
                onClick={() => handleSwitchToChild(child.id)}
                className="flex w-full items-center gap-4 rounded-lg border-2 border-gray-200 p-4 transition-all hover:border-kids-pink hover:bg-kids-pink/5"
              >
                <Baby size={32} className="text-kids-pink" />
                <div className="flex-1 text-left">
                  <p className="font-semibold text-gray-800">
                    子供の画面：{child.real_name || child.display_name || "登録なし"}
                  </p>
                  <p className="text-xs text-gray-500">
                    スタンプ {child.stamp_count}個
                  </p>
                </div>
                <span className="text-gray-400">→</span>
              </button>
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-kids-pink/5 p-3 text-xs text-gray-600">
            タップすると、お子様専用の画面（キッズモード）に切り替わります。
          </div>
        </section>
      )}
    </div>
  );
}
