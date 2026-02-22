'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface AddChildDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (childName: string, ticketNumber: string) => Promise<void>;
}

export default function AddChildDialog({ isOpen, onClose, onSave }: AddChildDialogProps) {
  const [childName, setChildName] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    // バリデーション
    if (!childName.trim()) {
      setError('名前を入力してください');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onSave(childName.trim(), ticketNumber.trim());
      // 成功したらフォームをリセット
      setChildName('');
      setTicketNumber('');
      onClose();
    } catch (err) {
      console.error('子供追加エラー:', err);
      setError('子供の追加に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setChildName('');
      setTicketNumber('');
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {/* ヘッダー */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">子供を追加</h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        {/* フォーム */}
        <div className="space-y-4">
          {/* 名前入力 */}
          <div>
            <label htmlFor="childName" className="mb-1 block text-sm font-medium text-gray-700">
              名前 <span className="text-red-500">*</span>
            </label>
            <input
              id="childName"
              type="text"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              disabled={isLoading}
              placeholder="例: 横山太郎"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
            />
          </div>

          {/* 診察券番号入力 */}
          <div>
            <label
              htmlFor="ticketNumber"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              診察券番号
            </label>
            <input
              id="ticketNumber"
              type="text"
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value)}
              disabled={isLoading}
              placeholder="例: 123456"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500">後から設定することもできます</p>
          </div>
        </div>

        {/* ボタン */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
