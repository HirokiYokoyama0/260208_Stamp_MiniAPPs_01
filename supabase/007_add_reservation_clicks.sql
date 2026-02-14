-- ============================================
-- つくばホワイト歯科 LINEミニアプリ
-- 予約ボタンクリック数トラッキング機能
-- ============================================
-- 作成日: 2026-02-14
-- 機能: 予約ボタン（アポツール）のクリック数を計測
-- ============================================

-- profilesテーブルにカラム追加
ALTER TABLE profiles
ADD COLUMN reservation_button_clicks INTEGER DEFAULT 0;

-- コメント追加
COMMENT ON COLUMN profiles.reservation_button_clicks IS '予約ボタンのクリック回数（累積）';

-- インデックス作成（クリック数でのソートや集計を高速化）
CREATE INDEX IF NOT EXISTS idx_profiles_reservation_clicks
  ON profiles(reservation_button_clicks);

-- ============================================
-- 安全にカウントアップする関数
-- ============================================

CREATE OR REPLACE FUNCTION increment_reservation_clicks(p_user_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  -- 該当ユーザーのクリック数を+1（NULLの場合は0として扱う）
  UPDATE profiles
  SET reservation_button_clicks = COALESCE(reservation_button_clicks, 0) + 1
  WHERE id = p_user_id
  RETURNING reservation_button_clicks INTO new_count;

  -- 更新された値を返す（ユーザーが存在しない場合は0）
  RETURN COALESCE(new_count, 0);
END;
$$;

-- 関数のコメント
COMMENT ON FUNCTION increment_reservation_clicks(TEXT) IS '予約ボタンのクリック数を安全に+1する関数（排他制御付き）';

-- ============================================
-- 完了メッセージ
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ 予約ボタンクリック計測機能の準備が完了しました！';
  RAISE NOTICE '📊 追加カラム: profiles.reservation_button_clicks (INTEGER)';
  RAISE NOTICE '🔧 追加関数: increment_reservation_clicks(user_id)';
  RAISE NOTICE '📈 次のステップ: APIエンドポイントとLIFF側の実装';
END $$;
