-- Share image of each news story (og:image / twitter:image of the source page),
-- shown on the News page cards. image_checked_at marks pages already looked at.
alter table news_items add column if not exists image_url text;
alter table news_items add column if not exists image_checked_at timestamptz;
