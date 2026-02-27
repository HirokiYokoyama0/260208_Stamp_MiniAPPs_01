'use client';

import { useState } from 'react';
import StarRating from './StarRating';
import NPSScale from './NPSScale';

interface SurveyFormProps {
  onSubmit: (answers: {
    q1Rating: number;
    q2Comment: string;
    q3Recommend: number;
  }) => void;
}

export default function SurveyForm({ onSubmit }: SurveyFormProps) {
  const [q1Rating, setQ1Rating] = useState<number>(0);
  const [q2Comment, setQ2Comment] = useState<string>('');
  const [q3Recommend, setQ3Recommend] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (q1Rating === 0) {
      alert('Q1の評価を選択してください');
      return;
    }
    if (q3Recommend === null) {
      alert('Q3の推奨度を選択してください');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        q1Rating,
        q2Comment,
        q3Recommend,
      });
    } catch (error) {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-center">🏥 ご利用満足度アンケート</h1>
      <p className="text-sm text-gray-600 mb-4 text-center">
        当院のサービスについてお聞かせください
      </p>

      <div className="bg-green-50 p-3 rounded-lg mb-6 text-center">
        <p className="text-sm text-green-800 font-medium">
          ✅ 回答いただくとスタンプ3個をプレゼント！
        </p>
      </div>

      {/* Q1: 5段階評価 */}
      <div className="mb-8">
        <h3 className="font-bold mb-3 text-gray-800">
          Q1. 当院の対応に満足していますか？
        </h3>
        <StarRating value={q1Rating} onChange={setQ1Rating} />
      </div>

      {/* Q2: 自由記述 */}
      <div className="mb-8">
        <h3 className="font-bold mb-3 text-gray-800">
          Q2. ご意見・ご感想（任意）
        </h3>
        <textarea
          value={q2Comment}
          onChange={(e) => setQ2Comment(e.target.value)}
          placeholder="ご自由にお書きください"
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          rows={4}
        />
      </div>

      {/* Q3: NPS（推奨度） */}
      <div className="mb-8">
        <h3 className="font-bold mb-3 text-gray-800">
          Q3. 当院を友人に勧めたいですか？
        </h3>
        <p className="text-xs text-gray-600 mb-3">
          0: まったく勧めない 〜 10: ぜひ勧める
        </p>
        <NPSScale value={q3Recommend} onChange={setQ3Recommend} />
      </div>

      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className={`w-full py-3 rounded-lg font-bold text-lg transition-colors ${
          isSubmitting
            ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
            : 'bg-green-600 text-white hover:bg-green-700'
        }`}
      >
        {isSubmitting ? '送信中...' : '送信する'}
      </button>
    </div>
  );
}
