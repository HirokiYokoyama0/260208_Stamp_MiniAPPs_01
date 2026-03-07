-- ============================================
-- つくばホワイト歯科 LINEミニアプリ
-- ケア記録機能テーブル作成スクリプト
-- ============================================
-- 作成日: 2026-03-07
-- 対象: ケア記録機能（My Dental Map）
-- 関連ドキュメント: Doc_dashboard/41_ケア記録機能.md
-- 関連ドキュメント: Doc_dashboard/42_ケア記録機能_LIFF開発者向け.md

-- ============================================
-- 1. patient_dental_records テーブル（患者の歯の記録）
-- ============================================

CREATE TABLE IF NOT EXISTS patient_dental_records (
  -- 主キー
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 外部キー
  patient_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,

  -- 歯の状態データ（JSONB形式）
  -- 構造: { "16": { "status": "cavity_completed", "status_label": "虫歯治療", "color": "green", "updated_at": "2026-03-07T10:00:00Z" }, ... }
  tooth_data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- メモ（スタッフ用・内部メモ）
  staff_memo TEXT,

  -- 次回予定メモ（患者にも表示される）
  next_visit_memo TEXT,

  -- 記録日時
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- メタ情報
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_patient_dental_records_patient_id
  ON patient_dental_records(patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_dental_records_staff_id
  ON patient_dental_records(staff_id);

CREATE INDEX IF NOT EXISTS idx_patient_dental_records_recorded_at
  ON patient_dental_records(recorded_at DESC);

-- JSONB用のGINインデックス（tooth_dataの検索を高速化）
CREATE INDEX IF NOT EXISTS idx_patient_dental_records_tooth_data
  ON patient_dental_records USING GIN (tooth_data);

-- RLS有効化
ALTER TABLE patient_dental_records ENABLE ROW LEVEL SECURITY;

-- anon keyで全件参照可能（アプリ層でpatient_idフィルタ）
CREATE POLICY "anon_can_read_dental_records"
  ON patient_dental_records FOR SELECT
  USING (true);

-- 管理画面（service_role）のみ挿入・更新可能
-- anon key では挿入・更新不可とする
CREATE POLICY "service_role_can_insert_dental_records"
  ON patient_dental_records FOR INSERT
  WITH CHECK (false);

CREATE POLICY "service_role_can_update_dental_records"
  ON patient_dental_records FOR UPDATE
  USING (false);

-- コメント
COMMENT ON TABLE patient_dental_records IS '患者の歯の治療記録（ケア記録機能）';
COMMENT ON COLUMN patient_dental_records.patient_id IS '患者ID（profiles.id への外部キー）';
COMMENT ON COLUMN patient_dental_records.staff_id IS '記録したスタッフID（staff.id への外部キー）';
COMMENT ON COLUMN patient_dental_records.tooth_data IS '歯の状態データ（JSONB形式）。歯番号をキーとし、各歯の状態を保存';
COMMENT ON COLUMN patient_dental_records.staff_memo IS 'スタッフ用内部メモ（患者には非表示）';
COMMENT ON COLUMN patient_dental_records.next_visit_memo IS '次回予定メモ（患者にも表示される）';
COMMENT ON COLUMN patient_dental_records.recorded_at IS '治療記録の記録日時';

-- ============================================
-- 2. ビュー: latest_dental_records（最新記録取得用）
-- ============================================

-- 各患者の最新の歯の状態を取得するビュー
CREATE OR REPLACE VIEW latest_dental_records AS
SELECT DISTINCT ON (patient_id)
  id,
  patient_id,
  staff_id,
  tooth_data,
  staff_memo,
  next_visit_memo,
  recorded_at,
  created_at,
  updated_at
FROM patient_dental_records
ORDER BY patient_id, recorded_at DESC;

COMMENT ON VIEW latest_dental_records IS '各患者の最新の歯の状態を取得するビュー';

-- ============================================
-- 3. ビュー: dental_records_with_staff（スタッフ情報付き）
-- ============================================

-- 管理画面用：スタッフ情報を含めた記録一覧
CREATE OR REPLACE VIEW dental_records_with_staff AS
SELECT
  pdr.id,
  pdr.patient_id,
  p.real_name AS patient_real_name,
  p.display_name AS patient_display_name,
  pdr.staff_id,
  s.display_name AS staff_display_name,
  pdr.tooth_data,
  pdr.staff_memo,
  pdr.next_visit_memo,
  pdr.recorded_at,
  pdr.created_at,
  pdr.updated_at
FROM patient_dental_records pdr
LEFT JOIN profiles p ON pdr.patient_id = p.id
LEFT JOIN staff s ON pdr.staff_id = s.id
ORDER BY pdr.recorded_at DESC;

COMMENT ON VIEW dental_records_with_staff IS 'ケア記録一覧（スタッフ情報・患者情報付き）管理画面用';

-- ============================================
-- 4. RPC関数: get_latest_dental_record（患者用）
-- ============================================

-- LIFF側から最新の歯の状態を取得する関数
CREATE OR REPLACE FUNCTION get_latest_dental_record(p_patient_id TEXT)
RETURNS TABLE(
  id UUID,
  patient_id TEXT,
  tooth_data JSONB,
  next_visit_memo TEXT,
  recorded_at TIMESTAMPTZ,
  staff_display_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pdr.id,
    pdr.patient_id,
    pdr.tooth_data,
    pdr.next_visit_memo,
    pdr.recorded_at,
    s.display_name AS staff_display_name
  FROM patient_dental_records pdr
  LEFT JOIN staff s ON pdr.staff_id = s.id
  WHERE pdr.patient_id = p_patient_id
  ORDER BY pdr.recorded_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_latest_dental_record IS '指定された患者の最新の歯の状態を取得（LIFF用）';

-- ============================================
-- 5. RPC関数: get_dental_record_history（患者用履歴取得）
-- ============================================

-- LIFF側から治療履歴を取得する関数
CREATE OR REPLACE FUNCTION get_dental_record_history(
  p_patient_id TEXT,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  recorded_at TIMESTAMPTZ,
  staff_display_name TEXT,
  next_visit_memo TEXT,
  tooth_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pdr.id,
    pdr.recorded_at,
    s.display_name AS staff_display_name,
    pdr.next_visit_memo,
    pdr.tooth_data
  FROM patient_dental_records pdr
  LEFT JOIN staff s ON pdr.staff_id = s.id
  WHERE pdr.patient_id = p_patient_id
  ORDER BY pdr.recorded_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_dental_record_history IS '指定された患者の治療履歴を取得（LIFF用タイムライン表示）';

-- ============================================
-- 6. RPC関数: get_tooth_detail_history（特定の歯の履歴）
-- ============================================

-- 特定の歯の治療履歴を取得する関数（オプション）
CREATE OR REPLACE FUNCTION get_tooth_detail_history(
  p_patient_id TEXT,
  p_tooth_number TEXT
)
RETURNS TABLE(
  recorded_at TIMESTAMPTZ,
  status_label TEXT,
  staff_display_name TEXT,
  color TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pdr.recorded_at,
    (pdr.tooth_data->p_tooth_number->>'status_label')::TEXT AS status_label,
    s.display_name AS staff_display_name,
    (pdr.tooth_data->p_tooth_number->>'color')::TEXT AS color
  FROM patient_dental_records pdr
  LEFT JOIN staff s ON pdr.staff_id = s.id
  WHERE pdr.patient_id = p_patient_id
    AND pdr.tooth_data ? p_tooth_number  -- JSONBに該当キーが存在するか
  ORDER BY pdr.recorded_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_tooth_detail_history IS '指定された患者の特定の歯の治療履歴を取得';

-- ============================================
-- 7. サンプルデータ（開発・テスト用）
-- ============================================

-- サンプル患者の記録を作成（既存のprofilesとstaffテーブルにデータが存在する前提）
-- 実際の運用では不要なため、DO NOTHING で衝突を無視

-- スタッフがいる場合のみサンプルデータを作成
DO $$
DECLARE
  sample_patient_id TEXT;
  sample_staff_id UUID;
BEGIN
  -- サンプル患者を取得（最初の1件）
  SELECT id INTO sample_patient_id FROM profiles LIMIT 1;

  -- サンプルスタッフを取得（最初の1件）
  SELECT id INTO sample_staff_id FROM staff WHERE is_active = true LIMIT 1;

  -- 患者とスタッフが存在する場合のみサンプル記録を挿入
  IF sample_patient_id IS NOT NULL AND sample_staff_id IS NOT NULL THEN
    INSERT INTO patient_dental_records (
      patient_id,
      staff_id,
      tooth_data,
      next_visit_memo,
      recorded_at
    )
    VALUES (
      sample_patient_id,
      sample_staff_id,
      jsonb_build_object(
        '16', jsonb_build_object(
          'status', 'cavity_completed',
          'status_label', '虫歯治療',
          'color', 'green',
          'updated_at', '2026-03-05T10:30:00Z'
        ),
        '32', jsonb_build_object(
          'status', 'scaling_completed',
          'status_label', '歯石除去',
          'color', 'green',
          'updated_at', '2026-03-05T10:35:00Z'
        ),
        '24', jsonb_build_object(
          'status', 'observation',
          'status_label', '経過観察',
          'color', 'yellow',
          'updated_at', '2026-02-15T14:00:00Z'
        )
      ),
      '次回は右下の詰め物チェック予定',
      '2026-03-05 10:40:00+09'
    )
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'サンプルデータを作成しました（patient_id: %, staff_id: %）', sample_patient_id, sample_staff_id;
  ELSE
    RAISE NOTICE 'サンプルデータをスキップしました（患者またはスタッフが存在しません）';
  END IF;
END $$;

-- ============================================
-- 完了メッセージ
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ケア記録機能テーブル作成完了';
  RAISE NOTICE '========================================';
  RAISE NOTICE '作成されたテーブル:';
  RAISE NOTICE '  - patient_dental_records (患者の歯の記録)';
  RAISE NOTICE '';
  RAISE NOTICE '作成されたビュー:';
  RAISE NOTICE '  - latest_dental_records (最新記録取得用)';
  RAISE NOTICE '  - dental_records_with_staff (管理画面用)';
  RAISE NOTICE '';
  RAISE NOTICE '作成されたRPC関数:';
  RAISE NOTICE '  - get_latest_dental_record() (LIFF用最新記録取得)';
  RAISE NOTICE '  - get_dental_record_history() (LIFF用履歴取得)';
  RAISE NOTICE '  - get_tooth_detail_history() (特定の歯の履歴)';
  RAISE NOTICE '';
  RAISE NOTICE 'セキュリティ:';
  RAISE NOTICE '  - RLS有効化済み';
  RAISE NOTICE '  - anon key: 参照のみ可能';
  RAISE NOTICE '  - service_role: 全操作可能（管理画面用）';
  RAISE NOTICE '========================================';
END $$;
