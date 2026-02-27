-- ============================================
-- つくばホワイト歯科 LINEミニアプリ
-- アンケート報酬時のlast_visit_date更新を除外
-- ============================================
-- 作成日: 2026-02-26
-- 目的: survey_reward時は来院扱いにしない

-- トリガー関数を修正: stamp_method = 'survey_reward' の場合は last_visit_date を更新しない
CREATE OR REPLACE FUNCTION update_profile_stamp_count()
RETURNS TRIGGER AS $$
BEGIN
  -- 008 の定義を継承しつつ、last_visit_date のみ survey_reward を除外
  UPDATE profiles
  SET
    stamp_count = (
      SELECT COALESCE(MAX(stamp_number), 0)
      FROM stamp_history
      WHERE user_id = NEW.user_id
    ),
    visit_count = (
      SELECT COUNT(*)
      FROM stamp_history
      WHERE user_id = NEW.user_id AND amount = 10
    ),
    last_visit_date = (
      SELECT MAX(visit_date)
      FROM stamp_history
      WHERE user_id = NEW.user_id
        AND stamp_method != 'survey_reward'
    ),
    updated_at = NOW()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーは既に存在するため、関数の定義のみ更新（CREATE OR REPLACE）

-- 確認用SQL（実行後に確認できる）
COMMENT ON FUNCTION update_profile_stamp_count IS 'スタンプ履歴追加時にprofilesを更新（survey_rewardは来院扱いにしない）';

-- ============================================
-- 完了メッセージ
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'トリガー関数修正完了';
  RAISE NOTICE '========================================';
  RAISE NOTICE '変更内容:';
  RAISE NOTICE '  - stamp_method = ''survey_reward'' の場合';
  RAISE NOTICE '  - last_visit_date を更新しない';
  RAISE NOTICE '  - stamp_count / visit_count は従来どおり更新';
  RAISE NOTICE '  - last_visit_date は survey_reward を除いた来院のみ反映';
  RAISE NOTICE '========================================';
END $$;
