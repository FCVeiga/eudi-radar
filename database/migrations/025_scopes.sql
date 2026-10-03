-- Scopes: everything Settings configures, as many as a user wants, each
-- switched active or inactive. A scope = name, instructions, context
-- documents, a search configuration and its own agents (Search, Triage,
-- Tender Evaluation, Proposal Manager, News Report). Tender Documents, Tender
-- Analysis, Feed Writer and Translator stay platform-wide (agent_settings).
create table if not exists scopes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  instructions text,                 -- was the company context
  active boolean not null default true,
  is_default boolean not null default false,   -- shown to visitors and to users without active scopes
  search_scope text,                 -- the Search Agent's plain-language scope
  search_config jsonb,               -- the Config Agent's parse (null = built-in default)
  search_status text, search_error text, search_parsed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists scopes_owner on scopes (owner_id);

create table if not exists scope_agent_settings (
  scope_id uuid not null references scopes(id) on delete cascade,
  agent_key text not null,
  enabled boolean not null default true,
  instructions text,
  prompt_override text,
  status text, error text,
  updated_at timestamptz default now(),
  primary key (scope_id, agent_key)
);

-- Which scope found which tender / story, and how relevant it is to it.
create table if not exists scope_items (
  scope_id uuid not null references scopes(id) on delete cascade,
  item_type text not null check (item_type in ('tender', 'news')),
  item_id text not null,
  relevance integer,                 -- tenders: the scope's triage relevance; news: importance
  candidate_type text,
  reason text,
  created_at timestamptz not null default now(),
  primary key (scope_id, item_type, item_id)
);
create index if not exists scope_items_item on scope_items (item_type, item_id);

-- Triage per (candidate, scope).
create table if not exists candidate_scopes (
  candidate_id text not null,
  scope_id uuid not null references scopes(id) on delete cascade,
  processed_at timestamptz,
  relevance integer,
  candidate_type text,
  primary key (candidate_id, scope_id)
);
create index if not exists candidate_scopes_pending on candidate_scopes (scope_id) where processed_at is null;

-- Per-scope work on a tender (evaluation, proposal brief) and on a story (report).
create table if not exists scope_evaluations (
  scope_id uuid not null references scopes(id) on delete cascade,
  opportunity_id text not null,
  evaluation jsonb, evaluated_at timestamptz, evaluation_started_at timestamptz, evaluation_error text,
  proposal_brief text, proposal_at timestamptz, proposal_started_at timestamptz, proposal_error text,
  primary key (scope_id, opportunity_id)
);
create table if not exists scope_news_reports (
  scope_id uuid not null references scopes(id) on delete cascade,
  news_id text not null,
  analysis jsonb, analysed_at timestamptz, started_at timestamptz, error text,
  primary key (scope_id, news_id)
);
alter table requirement_matches add column if not exists scope_id uuid references scopes(id) on delete cascade;
alter table company_documents add column if not exists scope_id uuid references scopes(id) on delete cascade;

alter table scopes enable row level security;
alter table scope_agent_settings enable row level security;
alter table scope_items enable row level security;
alter table candidate_scopes enable row level security;
alter table scope_evaluations enable row level security;
alter table scope_news_reports enable row level security;

-- Move the single configuration into the first scope (the default one).
do $$
declare s uuid; owner uuid; company jsonb; search jsonb;
begin
  if exists (select 1 from scopes) then return; end if;
  select id into owner from profiles order by created_at limit 1;
  select value into company from app_settings where key = 'company';
  select value into search from app_settings where key = 'search';
  insert into scopes (owner_id, name, instructions, active, is_default, search_scope, search_config, search_status, search_error, search_parsed_at)
  values (owner, coalesce(nullif(company->>'name', ''), 'EUDI Wallet & digital identity'), nullif(company->>'context', ''), true, true,
          search->>'scope', search->'config', search->>'status', search->>'error', (search->>'parsed_at')::timestamptz)
  returning id into s;
  insert into scope_agent_settings (scope_id, agent_key, enabled, instructions, prompt_override, status, error)
  select s, agent_key, enabled, instructions, prompt_override, status, error from agent_settings
  where agent_key in ('search', 'triage', 'tender_evaluation', 'proposal_manager', 'news_report');
  update company_documents set scope_id = s where scope_id is null;
  insert into scope_items (scope_id, item_type, item_id, relevance)
  select s, 'tender', opportunity_id, opportunity_relevance_score from opportunities on conflict do nothing;
  insert into scope_items (scope_id, item_type, item_id, relevance)
  select s, 'news', news_id, relevance_score from news_items on conflict do nothing;
  insert into candidate_scopes (candidate_id, scope_id, processed_at, relevance, candidate_type)
  select candidate_id, s, now(), relevance, candidate_type from candidates where processed on conflict do nothing;
  insert into candidate_scopes (candidate_id, scope_id) select candidate_id, s from candidates where not processed on conflict do nothing;
  insert into scope_evaluations (scope_id, opportunity_id, evaluation, evaluated_at, evaluation_error, proposal_brief, proposal_at, proposal_error)
  select s, opportunity_id, evaluation, evaluated_at, evaluation_error, proposal_brief, proposal_at, proposal_error
  from opportunities where evaluation is not null or proposal_brief is not null;
  update requirement_matches set scope_id = s where scope_id is null;
  insert into scope_news_reports (scope_id, news_id, analysis, analysed_at)
  select s, news_id, analysis, analysed_at from news_items where analysis is not null;
end $$;
