'use client';

import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

interface SurveyModalProps {
  isOpen: boolean;
  surveyId: string;
  title: string;
  description?: string;
  onClose: () => void;
  onPostpone: () => void;
}

export default function SurveyModal({
  isOpen,
  surveyId,
  title,
  description,
  onClose,
  onPostpone,
}: SurveyModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleAnswer = () => {
    router.push(`/survey/${surveyId}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2 pr-8">{title}</h2>
          {description && (
            <p className="text-gray-700 text-sm leading-relaxed">{description}</p>
          )}
        </div>

        <div className="bg-green-50 p-4 rounded-lg mb-6">
          <p className="text-green-800 font-medium text-center">
            ✅ 回答でスタンプ3個プレゼント！
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleAnswer}
            className="w-full py-3 bg-green-600 text-white rounded-lg font-bold text-lg hover:bg-green-700 transition-colors"
          >
            今すぐ回答する
          </button>
          <button
            onClick={onPostpone}
            className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            後で回答する
          </button>
        </div>
      </div>
    </div>
  );
}
