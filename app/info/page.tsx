"use client";

import { useLiff } from "@/hooks/useLiff";
import {
  Building2,
  MapPin,
  Phone,
  Clock,
  Heart,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";

const OFFICIAL_ACCOUNT_URL = "https://line.me/R/ti/p/@550mlcao";

export default function InfoPage() {
  const { isLoggedIn, isLoading, isFriend } = useLiff();

  // 友だち登録ボタンのクリック
  const handleAddFriend = () => {
    window.open(OFFICIAL_ACCOUNT_URL, "_blank");
  };

  return (
    <div className="px-4 py-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-800">医院情報</h2>

      {/* 公式LINE友だち登録セクション */}
      <section className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Heart className="text-primary" size={20} />
          <h3 className="font-semibold text-gray-800">公式LINE</h3>
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
      </section>

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
                〒305-0031
                <br />
                茨城県つくば市吾妻1-5-7 ダイワロイネットホテル1F
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Phone size={18} className="mt-0.5 text-gray-400" />
            <div>
              <p className="font-medium text-gray-700">電話番号</p>
              <a
                href="tel:0298686480"
                className="text-primary hover:underline"
              >
                029-868-6480
              </a>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock size={18} className="mt-0.5 text-gray-400" />
            <div>
              <p className="font-medium text-gray-700">診療時間</p>
              <div className="space-y-1 text-gray-600">
                <p>平日: 10:00 - 13:30 / 15:00 - 19:00</p>
                <p>土日祝: 10:00 - 13:30 / 14:30 - 18:00</p>
                <p className="text-xs text-gray-500">
                  ※最終受付は診療終了の30分前まで
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* アクセス */}
      <section className="mb-6">
        <h3 className="mb-3 font-semibold text-gray-800">アクセス</h3>
        <div className="text-sm text-gray-600">
          <p className="mb-2">つくばエクスプレス つくば駅 A3出口より徒歩1分</p>
          <a
            href="https://maps.app.goo.gl/your-google-maps-link"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Google Mapで開く
            <ExternalLink size={14} />
          </a>
        </div>
      </section>

      {/* 休診日カレンダー */}
      <section>
        <h3 className="mb-3 font-semibold text-gray-800">休診日</h3>
        <p className="text-sm text-gray-600">木曜日</p>
        <p className="mt-2 text-xs text-gray-500">
          ※臨時休診の場合は公式LINEでお知らせします
        </p>
      </section>
    </div>
  );
}
