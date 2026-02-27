'use client';

interface SurveyCompletedProps {
  rewardStamps: number; // 10倍整数（例: 3 = 0.3スタンプ）
}

export default function SurveyCompleted({ rewardStamps }: SurveyCompletedProps) {
  // 10倍整数を実際のスタンプ数に変換
  const displayStamps = rewardStamps / 10;

  return (
    <div className="p-4 max-w-md mx-auto text-center min-h-[60vh] flex flex-col items-center justify-center">
      <div className="mb-6">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-2">送信完了！</h2>
      </div>

      <p className="text-lg mb-6 text-gray-700">ご回答ありがとうございます！</p>

      <div className="bg-green-50 p-6 rounded-lg mb-6 w-full">
        <p className="text-green-800 font-bold text-lg">
          🎁 スタンプを{displayStamps}個付与しました！
        </p>
      </div>

      <p className="text-sm text-gray-600">2秒後に自動的にホームへ戻ります</p>
    </div>
  );
}
