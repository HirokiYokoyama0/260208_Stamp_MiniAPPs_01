'use client';

import { useEffect, useState } from 'react';
import { useLiff } from '@/hooks/useLiff';
import { useViewMode } from '@/contexts/ViewModeContext';
import { Users, UserPlus, Pencil, Trash2, Copy, Check, Loader2, ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { calculateStampDisplay } from '@/lib/stamps';
import AddChildDialog from '@/components/AddChildDialog';

interface FamilyMember {
  id: string;
  display_name: string;
  real_name: string | null;
  family_role: 'parent' | 'child';
  stamp_count: number;
  visit_count: number;
  line_user_id: string | null; // 仮想メンバーの場合はnull
  ticket_number: string | null;
}

interface Family {
  id: string;
  family_name: string;
  representative_user_id: string;
  members: FamilyMember[];
  total_stamp_count: number;
  total_visit_count: number;
  member_count: number;
}

export default function FamilyManagePage() {
  const { profile, isLoading: liffLoading } = useLiff();
  const { setViewMode, setSelectedChildId } = useViewMode();
  const router = useRouter();
  const [family, setFamily] = useState<Family | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState('');
  const [isAddChildDialogOpen, setIsAddChildDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);

  useEffect(() => {
    if (profile?.userId) {
      fetchFamily();
    }
  }, [profile]);

  const fetchFamily = async () => {
    if (!profile?.userId) return;

    try {
      const res = await fetch(`/api/families/me?userId=${profile.userId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '家族情報の取得に失敗しました');
      }

      setFamily(data.family);
      setNewName(data.family.family_name);
      setError('');
    } catch (err) {
      console.error('家族情報取得エラー:', err);
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateName = async () => {
    if (!profile?.userId || !newName.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/families/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.userId,
          familyName: newName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '家族名の更新に失敗しました');
      }

      setIsEditing(false);
      await fetchFamily();
    } catch (err) {
      console.error('家族名更新エラー:', err);
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddChild = async (childName: string, ticketNumber: string) => {
    if (!profile?.userId) return;

    try {
      const res = await fetch('/api/families/members/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.userId,
          childName,
          ticketNumber,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '子供の追加に失敗しました');
      }

      // 家族情報を再取得
      await fetchFamily();
    } catch (err) {
      console.error('子供追加エラー:', err);
      throw err;
    }
  };

  const handleEditMember = async (memberId: string, childName: string, ticketNumber: string) => {
    if (!profile?.userId) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/families/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.userId,
          childName,
          ticketNumber,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'メンバー情報の更新に失敗しました');
      }

      setEditingMember(null);
      await fetchFamily();
    } catch (err) {
      console.error('メンバー編集エラー:', err);
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!profile?.userId) return;
    if (!confirm(`${memberName}さんを家族から削除しますか？`)) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/families/members/${memberId}?userId=${profile.userId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'メンバーの削除に失敗しました');
      }

      await fetchFamily();
    } catch (err) {
      console.error('メンバー削除エラー:', err);
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChildMode = async (memberId: string) => {
    console.log('[FamilyManage] 子供の画面に切り替え:', memberId);

    // ViewModeContextに子供のIDを保存
    setSelectedChildId(memberId);

    // キッズモードに切り替え
    await setViewMode('kids');

    // ホーム画面にリダイレクト
    router.push('/');
  };

  const handleCopyInviteCode = async () => {
    if (!family?.id) return;

    try {
      await navigator.clipboard.writeText(family.id);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('コピーエラー:', err);
    }
  };

  if (liffLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!family) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">{error || '家族情報が見つかりません'}</p>
          <Link href="/" className="text-primary hover:underline">
            ホームに戻る
          </Link>
        </div>
      </div>
    );
  }

  const isParent = family.members.find(m => m.id === profile?.userId)?.family_role === 'parent';
  const { fullStamps: totalFullStamps } = calculateStampDisplay(family.total_stamp_count);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-2xl mx-auto">
        {/* 戻るボタン */}
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft size={20} />
          <span>設定に戻る</span>
        </Link>

        {/* 家族名 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          {isEditing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                placeholder="家族名"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleUpdateName}
                  disabled={isLoading || !newName.trim()}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 font-medium"
                >
                  保存
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setNewName(family.family_name);
                  }}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-800">{family.family_name}</h1>
              {isParent && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Pencil size={20} className="text-gray-600" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* 家族合計スタンプ */}
        <div className="bg-gradient-to-r from-primary/10 to-sky-50 rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="text-primary" size={24} />
            <h2 className="text-lg font-semibold text-gray-800">家族のスタンプ</h2>
          </div>
          <p className="text-4xl font-bold text-primary mb-2">{totalFullStamps}個</p>
          <p className="text-sm text-gray-600">
            {family.member_count}人で協力中 · 来院{family.total_visit_count}回
          </p>
        </div>

        {/* 招待コード（親のみ表示） */}
        {isParent && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-gray-800">📱 お子様のスマホから参加</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              お子様が自分のLINEアカウントを持っている場合、このコードを共有してください
            </p>
            <div className="flex gap-2">
              <code className="flex-1 bg-gray-100 px-3 py-2 rounded border border-gray-300 text-sm font-mono overflow-x-auto">
                {family.id}
              </code>
              <button
                onClick={handleCopyInviteCode}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2 font-medium"
              >
                {isCopied ? (
                  <>
                    <Check size={18} />
                    コピー済み
                  </>
                ) : (
                  <>
                    <Copy size={18} />
                    コピー
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* メンバー一覧 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">メンバー</h2>
            {isParent && (
              <button
                onClick={() => setIsAddChildDialogOpen(true)}
                className="flex items-center gap-2 text-primary hover:text-primary-dark text-sm font-medium transition-colors"
                title="スマホを持っていない小さなお子様を追加"
              >
                <UserPlus size={18} />
                👶 スマホなしの子供を追加
              </button>
            )}
          </div>

          <div className="space-y-3">
            {family.members.map((member) => {
              const { fullStamps } = calculateStampDisplay(member.stamp_count);
              const isVirtualChild = member.line_user_id === null;
              const isEditingThis = editingMember?.id === member.id;

              return (
                <div
                  key={member.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                >
                  {isEditingThis ? (
                    // 編集モード（仮想メンバーのみ）
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">名前</label>
                        <input
                          type="text"
                          defaultValue={member.real_name || ""}
                          id={`edit-name-${member.id}`}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                          placeholder="名前を入力"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">診察券番号</label>
                        <input
                          type="text"
                          defaultValue={member.ticket_number || ''}
                          id={`edit-ticket-${member.id}`}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const nameInput = document.getElementById(`edit-name-${member.id}`) as HTMLInputElement;
                            const ticketInput = document.getElementById(`edit-ticket-${member.id}`) as HTMLInputElement;
                            handleEditMember(member.id, nameInput.value, ticketInput.value);
                          }}
                          disabled={isLoading}
                          className="flex-1 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm font-medium disabled:opacity-50"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingMember(null)}
                          disabled={isLoading}
                          className="flex-1 px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm font-medium"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    // 通常表示
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-800">
                            {isVirtualChild ? (member.real_name || "登録なし") : member.display_name}
                          </p>
                          {member.family_role === 'parent' && (
                            <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded font-medium">
                              代表者
                            </span>
                          )}
                          {isVirtualChild && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded font-medium">
                              仮想
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          スタンプ: {fullStamps}個 / 来院: {member.visit_count}回
                        </p>
                        {member.ticket_number && (
                          <p className="text-xs text-gray-400 mt-1">
                            診察券: {member.ticket_number}
                          </p>
                        )}
                      </div>

                      {isParent && member.family_role === 'child' && (
                        <div className="flex items-center gap-2">
                          {/* 仮想メンバーの場合は「開く」ボタンを表示 */}
                          {isVirtualChild && (
                            <button
                              onClick={() => handleOpenChildMode(member.id)}
                              disabled={isLoading}
                              className="px-3 py-1.5 text-sm bg-kids-pink text-white rounded-lg hover:bg-kids-pink/90 transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                              開く
                              <ExternalLink size={14} />
                            </button>
                          )}
                          {/* 仮想メンバーの場合は編集ボタンを表示 */}
                          {isVirtualChild && (
                            <button
                              onClick={() => setEditingMember(member)}
                              disabled={isLoading}
                              className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Pencil size={18} />
                            </button>
                          )}
                          {/* 削除ボタン */}
                          <button
                            onClick={() => handleRemoveMember(
                              member.id,
                              isVirtualChild ? (member.real_name || "登録なし") : member.display_name
                            )}
                            disabled={isLoading}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 子供追加ダイアログ */}
      <AddChildDialog
        isOpen={isAddChildDialogOpen}
        onClose={() => setIsAddChildDialogOpen(false)}
        onSave={handleAddChild}
      />
    </div>
  );
}
