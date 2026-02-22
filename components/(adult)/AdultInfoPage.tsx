"use client";

import {
  Building2,
  MapPin,
  Clock,
  ExternalLink,
} from "lucide-react";

export default function AdultInfoPage() {

  return (
    <div className="px-4 py-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-800">医院情報</h2>

      {/* 医院基本情報 */}
      <section className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <Building2 className="text-primary" size={20} />
          <h3 className="font-semibold text-gray-800">基本情報</h3>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <MapPin size={18} className="mt-0.5 text-gray-400" />
            <div>
              <p className="font-medium text-gray-700">住所</p>
              <p className="text-gray-600">
                〒305-0822
                <br />
                茨城県つくば市苅間1885番地1
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock size={18} className="mt-0.5 text-gray-400" />
            <div>
              <p className="font-medium text-gray-700">診療時間</p>
              <div className="space-y-2 text-gray-600">
                <div>
                  <p>月・火・水・木・金・土: 9:00 - 13:00 / 14:30 - 18:00</p>
                </div>
                <div>
                  <p className="mt-2 text-xs text-primary-dark">
                    2026年4月より: 9:00 - 17:30
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* アクセス */}
      <section className="mb-6">
        <h3 className="mb-3 font-semibold text-gray-800">アクセス</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>• つくばエクスプレス つくば駅 A2出口より車5分</p>
          <p>• つくばエクスプレス 研究学園駅より車6分</p>
          <p>• つくばエクスプレス 万博記念公園駅より車10分</p>
          <p className="mt-2 text-xs text-gray-500">
            ※医院すぐ裏に13台分の駐車スペースあり
          </p>
          <div className="mt-3">
            <a
              href="https://4182jp.net/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              公式ホームページ
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* 休診日カレンダー */}
      <section>
        <h3 className="mb-3 font-semibold text-gray-800">休診日</h3>
        <p className="text-sm text-gray-600">日曜日・祝日</p>
        <p className="mt-2 text-xs text-gray-500">
          ※院内ミーティング日は臨時休診となります
        </p>
        <p className="mt-1 text-xs text-gray-500">
          ※休診日の詳細は公式LINEでお知らせします
        </p>
      </section>
    </div>
  );
}
