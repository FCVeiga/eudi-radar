-- Following per scope: each scope follows its own sources (the registry stays shared).
create table if not exists scope_sources (
  scope_id uuid not null references scopes(id) on delete cascade,
  source_id varchar(64) not null references sources(source_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (scope_id, source_id)
);
create index if not exists scope_sources_source on scope_sources (source_id);
alter table scope_sources enable row level security;

-- General-interest sources for the General scope.
insert into sources (source_id, name, source_type, url, feed_url, handle, method, enabled, check_every_days, status, priority, rss_available, country) values
  ('GEN-001', 'Politico Europe', 'NEWS', 'https://www.politico.eu', 'https://www.politico.eu/feed/', null, 'rss', true, 1, 'ACTIVE', 2, true, null),
  ('GEN-002', 'European Commission — press corner', 'NEWS', 'https://ec.europa.eu/commission/presscorner', 'https://ec.europa.eu/commission/presscorner/api/rss?language=en', null, 'rss', true, 1, 'ACTIVE', 2, true, null),
  ('GEN-003', 'Euronews Business', 'NEWS', 'https://www.euronews.com/business', 'https://www.euronews.com/rss?level=vertical&name=business', null, 'rss', true, 1, 'ACTIVE', 3, true, null),
  ('GEN-004', 'Global Government Forum', 'NEWS', 'https://www.globalgovernmentforum.com', 'https://www.globalgovernmentforum.com/feed/', null, 'rss', true, 1, 'ACTIVE', 3, true, null),
  ('GEN-005', 'Euractiv', 'NEWS', 'https://www.euractiv.com', null, null, 'site_search', true, 2, 'ACTIVE', 2, false, null),
  ('GEN-006', 'Devex', 'NEWS', 'https://www.devex.com', null, null, 'site_search', true, 3, 'ACTIVE', 3, false, null),
  ('GEN-007', 'ISO news', 'STANDARDS_BODY', 'https://www.iso.org', 'https://www.iso.org/contents/news.rss', null, 'rss', true, 1, 'ACTIVE', 3, true, null),
  ('GEN-008', 'CINEA (Connecting Europe Facility, Innovation Fund)', 'EU_PROGRAMME', 'https://cinea.ec.europa.eu', null, null, 'site_search', true, 7, 'ACTIVE', 3, false, null),
  ('GEN-009', 'r/europe', 'SOCIAL_REDDIT', 'https://www.reddit.com/r/europe', 'https://www.reddit.com/r/europe/.rss', 'r/europe', 'rss', true, 1, 'ACTIVE', 4, true, null),
  ('GEN-010', 'r/procurement', 'SOCIAL_REDDIT', 'https://www.reddit.com/r/procurement', 'https://www.reddit.com/r/procurement/.rss', 'r/procurement', 'rss', true, 1, 'ACTIVE', 4, true, null)
on conflict (source_id) do nothing;

-- EUDI Wallet & digital identity follows everything it followed before (the whole registry, minus the new general ones).
insert into scope_sources (scope_id, source_id)
select s.id, src.source_id from scopes s cross join sources src
where s.name = 'EUDI Wallet & digital identity' and src.source_id not like 'GEN-%'
on conflict do nothing;

-- General: TED, national and EU-level procurement portals, EU funding, standards bodies, development banks, general news and social.
insert into scope_sources (scope_id, source_id)
select s.id, src.source_id from scopes s cross join sources src
where s.is_default and (
  src.source_id like 'NAT-%' or src.source_id like 'GEN-%'
  or src.source_id in ('EU-001', 'EU-007', 'INTL-033',              -- TED, Commission procurement, UNGM
                       'EU-002', 'EU-005', 'EU-006',                 -- Funding & Tenders portal, Digital Europe, HaDEA
                       'EU-018', 'EU-017', 'INTL-034',               -- CEN/CENELEC, ETSI, ITU
                       'INTL-027', 'INTL-028', 'INTL-029', 'INTL-030', 'INTL-031', 'INTL-032'))  -- development banks
on conflict do nothing;

-- Everyone's first workspace is "My Workspace" (the platform's first one was named "Default").
update workspaces set name = 'My Workspace' where name in ('My workspace', 'Default');
