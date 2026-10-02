-- One registry for everything the radar follows: tender portals, government
-- and EU sites, funding portals, standards bodies, development banks, news
-- feeds and social accounts. Each source says HOW it is monitored:
--   ted         TED search API (built in)
--   rss         RSS/Atom feed (feed_url)
--   site_search domain-restricted web search every check_every_days
--   off         listed only
-- Followed accounts (tracked_accounts) move in here; their activity table
-- becomes source_activity.

alter type sourcetype add value if not exists 'SOCIAL_REDDIT';

alter table sources add column if not exists method text not null default 'off';
alter table sources add column if not exists feed_url text;
alter table sources add column if not exists handle text;
alter table sources add column if not exists enabled boolean not null default true;
alter table sources add column if not exists check_every_days integer not null default 7;
alter table sources add column if not exists last_error text;
alter table sources add column if not exists created_at timestamptz default now();

alter table account_activity rename to source_activity;
alter table source_activity add column if not exists source_id varchar(64) references sources(source_id) on delete cascade;
-- ingested = already turned into a pipeline candidate
alter table source_activity add column if not exists ingested boolean not null default false;

-- Data moves done alongside this migration (see the session that added it):
-- active tracked_accounts copied to sources as 'ACC-<id>'; source_activity.source_id
-- backfilled, account_id dropped, unique (source_id, external_id); national
-- portals from countries copied as 'NAT-<code>' (method site_search); TED set to 'ted'.
create unique index if not exists uq_source_activity on source_activity(source_id, external_id);

-- snippet/description of an activity item, used by triage
alter table source_activity add column if not exists summary text;

-- site-search finds show in Live activity only once triage found them relevant
alter table source_activity add column if not exists relevant boolean;
