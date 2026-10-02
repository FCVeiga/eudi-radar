-- The News Report Agent runs when a news page is first opened: a lock so two
-- visitors don't start two runs, and the last error to show on the page.
alter table news_items add column if not exists report_started_at timestamptz;
alter table news_items add column if not exists report_error text;
