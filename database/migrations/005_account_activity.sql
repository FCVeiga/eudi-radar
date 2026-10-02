-- Followed accounts (left sidebar) and their latest activity (Live activity panel).
-- Feeds are fetched by the webapp (webapp/lib/activity.ts), at most every 10 min.
alter table tracked_accounts add column if not exists feed_url text;          -- resolved RSS/Atom; null = not connectable yet
alter table tracked_accounts add column if not exists last_fetched_at timestamptz;
alter table tracked_accounts add column if not exists last_error text;
alter table tracked_accounts add column if not exists created_at timestamptz default now();

create table if not exists account_activity (
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES tracked_accounts(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,          -- feed guid / link
  title TEXT,
  url TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (account_id, external_id)
);
create index if not exists idx_account_activity_published on account_activity(published_at desc);
alter table account_activity enable row level security;
