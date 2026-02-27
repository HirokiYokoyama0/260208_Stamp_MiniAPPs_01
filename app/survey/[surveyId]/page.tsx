'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLiff } from '@/hooks/useLiff';
import SurveyForm from '@/components/survey/SurveyForm';
import SurveyCompleted from '@/components/survey/SurveyCompleted';

export default function SurveyPage() {
  const params = useParams();
  const router = useRouter();
  const { profile, isLoading: liffLoading } = useLiff();

  const surveyId = params.surveyId as string;
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rewardStamps, setRewardStamps] = useState(0);

  useEffect(() => {
    if (liffLoading) return;
    if (!profile) {
      // LIFF未ログインの場合はホームへリダイレクト
      router.push('/');
      return;
    }

    checkIfAnswered();
  }, [profile, liffLoading, surveyId]);

  const checkIfAnswered = async () => {
    if (!profile) return;

    try {
      const res = await fetch('/api/survey/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.userId }),
      });

      const data = await res.json();

      // このsurveyIdが対象でない、または既に回答済み
      if (!data.shouldShow || data.surveyId !== surveyId) {
        setHasAnswered(true);
      }
    } catch (error) {
      console.error('アンケート状態確認エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (answers: {
    q1Rating: number;
    q2Comment: string;
    q3Recommend: number;
  }) => {
    if (!profile) return;

    try {
      const res = await fetch('/api/survey/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.userId,
          surveyId,
          q1Rating: answers.q1Rating,
          q2Comment: answers.q2Comment,
          q3Recommend: answers.q3Recommend,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setRewardStamps(data.rewardStamps || 3);
        setIsCompleted(true);
        // 2秒後にホームへ戻る
        setTimeout(() => router.push('/'), 2000);
      } else {
        alert(data.message || '送信に失敗しました');
      }
    } catch (error) {
      console.error('アンケート送信エラー:', error);
      alert('送信に失敗しました');
    }
  };

  if (loading || liffLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (hasAnswered) {
    return (
      <div className="p-4 text-center min-h-[60vh] flex flex-col items-center justify-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold mb-4">回答済みです</h2>
        <p className="mb-4 text-gray-600">このアンケートは既に回答済みです。</p>
        <p className="mb-6 text-gray-600">ご協力ありがとうございました！</p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors"
        >
          ホームへ戻る
        </button>
      </div>
    );
  }

  if (isCompleted) {
    return <SurveyCompleted rewardStamps={rewardStamps} />;
  }

  return <SurveyForm onSubmit={handleSubmit} />;
}
