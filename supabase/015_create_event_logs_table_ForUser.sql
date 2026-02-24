-- 015_create_event_logs_table_ForUser.sql
-- ユーザー行動ログテーブル（マーケティング分析・効果測定用）
-- 作成日: 2026-02-23
-- データ保持期間: 400日（約13ヶ月）- 前年同期比較が可能

-- =====================================
-- 1. event_logs テーブル作成
-- =====================================
create table if not exists event_logs (
  id uuid default gen_random_uuid() primary key,
  user_id text references profiles(id) on delete cascade,  -- 誰が
  event_name text not null,                                -- 何を（'app_open', 'stamp_click' など）
  source text,                                             -- どこから（'line_msg_0222' など）
  metadata jsonb,                                          -- その他詳細（ブラウザ情報など自由枠）
  created_at timestamptz default now()                     -- いつ
);

-- =====================================
-- 2. インデックス作成（高速検索用）
-- =====================================
create index idx_event_logs_user_id on event_logs(user_id);
create index idx_event_logs_event_name on event_logs(event_name);
create index idx_event_logs_created_at on event_logs(created_at desc);
create index idx_event_logs_source on event_logs(source) where source is not null;

-- 複合インデックス（よく使う組み合わせ）
create index idx_event_logs_user_event on event_logs(user_id, event_name);
create index idx_event_logs_event_created on event_logs(event_name, created_at desc);

-- =====================================
-- 3. RLSポリシー（セキュリティ）
-- =====================================
alter table event_logs enable row level security;

-- ユーザーは自分のログのみ書き込み可能
create policy "Users can insert their own logs"
  on event_logs for insert
  with check (true);  -- user_idはクライアント側でLIFF User IDを使用

-- 管理者は全ログ参照可能（サービスロールキー使用時）
create policy "Service role can view all logs"
  on event_logs for select
  using (true);

-- ユーザーは自分のログのみ参照可能（将来的に履歴表示する場合）
create policy "Users can view their own logs"
  on event_logs for select
  using (auth.uid()::text = user_id or user_id is null);

-- =====================================
-- 4. コメント追加（ドキュメント化）
-- =====================================
comment on table event_logs is 'ユーザー行動ログ（マーケティング分析用）';
comment on column event_logs.id is '一意のログID（UUID）';
comment on column event_logs.user_id is 'ユーザーID（profiles.idへの外部キー）';
comment on column event_logs.event_name is 'イベント種別: app_open, stamp_scan, reward_exchange など';
comment on column event_logs.source is '流入元: line_msg_YYMMDD, direct, web など';
comment on column event_logs.metadata is '追加データ（JSON形式）: user_agent, screen_size, referrer など';
comment on column event_logs.created_at is 'イベント発生日時（タイムゾーン付き）';

-- =====================================
-- 5. データ保持期間設定（オプション）
-- =====================================
-- 400日以上前のログを自動削除する関数（データ量削減用）
-- 注: 400日（約13ヶ月）保持することで以下のメリット:
--   - 前年同期比較が可能（例: 去年の2月 vs 今年の2月）
--   - 季節変動の年次比較が可能
--   - 年間を通じたトレンド分析が可能
--   - LINE配信キャンペーンの長期効果測定が可能
-- データ量: 1日1000イベントでも400日で約110MB（Free Planで十分）
create or replace function delete_old_event_logs()
returns void as $$
begin
  delete from event_logs
  where created_at < current_date - interval '400 days';
end;
$$ language plpgsql security definer;

comment on function delete_old_event_logs is '400日（約13ヶ月）以上前のイベントログを削除（定期実行推奨）';

-- =====================================
-- 6. 集計用ビュー（よく使うクエリ）
-- =====================================

-- 日別アクティブユーザー数（DAU）
-- 400日分（約13ヶ月）のデータで前年同期比較が可能
create or replace view daily_active_users as
select
  date(created_at) as date,
  count(distinct user_id) as active_users
from event_logs
where event_name = 'app_open'
  and created_at >= current_date - interval '400 days'
group by date(created_at)
order by date desc;

comment on view daily_active_users is '日別アクティブユーザー数（DAU） - 過去400日分で前年同期比較可能';

-- イベント別集計（人気機能ランキング）
create or replace view event_summary as
select
  event_name,
  count(*) as total_events,
  count(distinct user_id) as unique_users,
  min(created_at) as first_occurrence,
  max(created_at) as last_occurrence
from event_logs
where created_at >= current_date - interval '30 days'
group by event_name
order by total_events desc;

comment on view event_summary is 'イベント別集計（直近30日）';

-- =====================================
-- 7. サンプルデータ（テスト用・削除可）
-- =====================================
-- テスト用のサンプルログ（実運用前に削除してください）
-- insert into event_logs (user_id, event_name, source, metadata) values
--   ('test-user-001', 'app_open', 'line_msg_0223', '{"user_agent": "Mozilla/5.0", "screen_size": "375x812"}'),
--   ('test-user-001', 'stamp_page_view', 'direct', '{"current_stamp_count": 50}'),
--   ('test-user-002', 'reservation_button_click', 'direct', '{"from_page": "/", "current_stamp_count": 30}');

-- =====================================
-- 実装完了
-- =====================================
-- このSQLファイルをSupabase SQL Editorで実行してください
--
-- 実行後の確認:
-- 1. Table Editor で event_logs テーブルが表示されることを確認
-- 2. 以下のクエリでテスト:
--    select * from event_logs limit 10;
-- 3. ビューの確認:
--    select * from daily_active_users;
--    select * from event_summary;
