-- Home feed posts written by the feed-writer agent (agents/feed_writer.py).
create table if not exists feed_posts (
  post_id VARCHAR(80) PRIMARY KEY,
  kind VARCHAR(16),
  event VARCHAR(32),
  opportunity_id VARCHAR(64),
  news_id VARCHAR(64),
  change_event_id INTEGER,
  category VARCHAR(32),
  country VARCHAR(4),
  headline TEXT,
  body TEXT,
  score INTEGER,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  rank INTEGER,
  prev_rank INTEGER,
  ranked_at TIMESTAMPTZ
);
create index if not exists idx_feed_posts_posted on feed_posts(posted_at desc);
-- Same posture as every other table: RLS on, only the service key reads it.
alter table feed_posts enable row level security;
