-- ============================================================================
-- EUDI Wallet Opportunity Radar — Supabase/Postgres migration
-- Generated from database/models.py, adapted for Postgres + Supabase.
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- Safe to run once on a fresh project. NOT idempotent.
-- ============================================================================

create extension if not exists vector;
create extension if not exists pgcrypto;

create type sourcetype as enum (
  'PROCUREMENT_PORTAL','FUNDING_PORTAL','DIGITAL_AGENCY','IDENTITY_AUTHORITY',
  'GOVERNMENT','LSP','EU_PROGRAMME','DEVELOPMENT_BANK','STANDARDS_BODY',
  'INDUSTRY_SOURCE','CONSORTIUM','NEWS','SOCIAL_LINKEDIN','SOCIAL_TWITTER'
);
create type sourcestatus as enum ('ACTIVE','DEGRADED','DOWN','RETIRED');
create type confidencelevel as enum ('CONFIRMED','INFERRED','UNCLEAR','NOT_DISCLOSED');
create type matchstatus as enum ('MATCH','PARTIAL_MATCH','PARTNER_NEEDED','NO_MATCH','UNKNOWN');
create type changeimportance as enum ('CRITICAL','MATERIAL','MINOR');
create type actionpriority as enum ('P0_IMMEDIATE_ACTION','P1_HIGH_PRIORITY','P2_REVIEW','P3_WATCH','P4_ARCHIVE');
create type documenttype as enum (
  'CONTRACT_NOTICE','PROGRAMME','TENDER_SPECIFICATIONS','TERMS_OF_REFERENCE',
  'TECHNICAL_SPECIFICATIONS','SELECTION_CRITERIA','AWARD_CRITERIA',
  'FINANCIAL_PROPOSAL','CONTRACT','ANNEX','CLARIFICATION','CORRIGENDUM',
  'Q_AND_A','FORM','OTHER'
);

create table countries (
  code VARCHAR(4) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  region VARCHAR(64),
  national_procurement_portal VARCHAR(512),
  digital_ministry VARCHAR(256),
  digital_agency VARCHAR(256),
  eid_authority VARCHAR(256),
  eudi_wallet_authority VARCHAR(256),
  cybersecurity_authority VARCHAR(256),
  trust_services_supervisor VARCHAR(256),
  national_funding_agency VARCHAR(256),
  national_rd_portal VARCHAR(512),
  status_code INTEGER DEFAULT 0,
  last_verified TIMESTAMPTZ,
  wallet_name VARCHAR(256),
  wallet_status_raw VARCHAR(512),
  assurance_level VARCHAR(16),
  launch_date VARCHAR(16),
  official_url VARCHAR(512),
  country_url VARCHAR(512),
  status_source VARCHAR(512)
);

create table sources (
  source_id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(256) NOT NULL,
  country VARCHAR(4) REFERENCES countries(code),
  region VARCHAR(64),
  source_type sourcetype NOT NULL,
  url VARCHAR(512),
  search_url VARCHAR(512),
  api_available BOOLEAN DEFAULT false,
  rss_available BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 3,
  languages JSONB DEFAULT '[]',
  keywords JSONB DEFAULT '[]',
  last_checked TIMESTAMPTZ,
  last_successful_check TIMESTAMPTZ,
  status sourcestatus DEFAULT 'ACTIVE',
  response_status VARCHAR(32),
  number_results_last_run INTEGER,
  parser_status VARCHAR(32)
);
create index idx_sources_country on sources(country);
create index idx_sources_type on sources(source_type);

create table organisations (
  org_id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(256) NOT NULL,
  country VARCHAR(4) REFERENCES countries(code),
  capabilities JSONB DEFAULT '[]',
  known_eudi_projects JSONB DEFAULT '[]',
  lsp_membership JSONB DEFAULT '[]',
  tender_participation JSONB DEFAULT '[]',
  relationship_status VARCHAR(64),
  potential_partner_role VARCHAR(128)
);

create table programmes (
  programme_id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  coordinator VARCHAR(256),
  partners JSONB DEFAULT '[]',
  countries JSONB DEFAULT '[]',
  budget FLOAT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  use_cases JSONB DEFAULT '[]',
  open_calls JSONB DEFAULT '[]',
  procurements JSONB DEFAULT '[]',
  partner_searches JSONB DEFAULT '[]',
  subcontracting JSONB DEFAULT '[]',
  news JSONB DEFAULT '[]',
  funding_source VARCHAR(128)
);

create table rollout_states (
  id SERIAL PRIMARY KEY,
  country_code VARCHAR(4) REFERENCES countries(code),
  wallet_provider VARCHAR(256),
  development_status VARCHAR(64),
  procurement_status VARCHAR(64),
  procurement_reference VARCHAR(128),
  architecture_status VARCHAR(64),
  pid_provider VARCHAR(256),
  certification_body VARCHAR(256),
  certification_status VARCHAR(64),
  expected_launch TIMESTAMPTZ,
  known_budget FLOAT,
  funding_source VARCHAR(128),
  lsp_participation JSONB DEFAULT '[]',
  known_technology_partners JSONB DEFAULT '[]',
  last_material_update TIMESTAMPTZ,
  next_expected_event VARCHAR(256),
  opportunity_probability FLOAT,
  status_code INTEGER DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT now()
);
create index idx_rollout_country on rollout_states(country_code);

create table queries (
  query_id SERIAL PRIMARY KEY,
  query_pack VARCHAR(64),
  query_text TEXT NOT NULL,
  country VARCHAR(4),
  language VARCHAR(8),
  executed_at TIMESTAMPTZ DEFAULT now(),
  results_count INTEGER DEFAULT 0,
  source_id VARCHAR(64) REFERENCES sources(source_id)
);

create table candidates (
  candidate_id VARCHAR(64) PRIMARY KEY,
  discovered_at TIMESTAMPTZ DEFAULT now(),
  source_id VARCHAR(64) REFERENCES sources(source_id),
  source_url VARCHAR(1024),
  title TEXT,
  description TEXT,
  publication_date TIMESTAMPTZ,
  country VARCHAR(4),
  language VARCHAR(8),
  raw_text TEXT,
  discovery_query TEXT,
  potential_categories JSONB DEFAULT '[]',
  processed BOOLEAN DEFAULT false,
  relevance INTEGER,
  opportunity_probability FLOAT,
  eudi_relevance VARCHAR(32),
  commercial_relevance VARCHAR(32),
  candidate_type VARCHAR(64),
  triage_reason TEXT,
  deep_analysis_required BOOLEAN DEFAULT false,
  triage_output JSONB
);
create index idx_candidates_processed on candidates(processed);
create index idx_candidates_relevance on candidates(relevance);
create index idx_candidates_source on candidates(source_id);

create table opportunities (
  opportunity_id VARCHAR(64) PRIMARY KEY,
  title TEXT NOT NULL,
  reference VARCHAR(128),
  country VARCHAR(4),
  authority VARCHAR(256),
  opportunity_type VARCHAR(64),
  status VARCHAR(64),
  publication_date TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  estimated_value FLOAT,
  currency VARCHAR(8),
  duration_months INTEGER,
  funding_rate FLOAT,
  official_url VARCHAR(1024),
  summary TEXT,
  verified_at TIMESTAMPTZ,
  status_evidence TEXT,
  first_detected TIMESTAMPTZ DEFAULT now(),
  last_checked TIMESTAMPTZ,
  last_change TIMESTAMPTZ,
  relevance_score INTEGER DEFAULT 0,
  go_nogo_score INTEGER DEFAULT 0,
  opportunity_relevance_score INTEGER,
  bid_readiness_score INTEGER,
  action_priority actionpriority
);
create index idx_opportunities_country on opportunities(country);
create index idx_opportunities_deadline on opportunities(deadline);
create index idx_opportunities_priority on opportunities(action_priority);
create index idx_opportunities_relevance on opportunities(opportunity_relevance_score);

create table documents (
  document_id VARCHAR(64) PRIMARY KEY,
  opportunity_id VARCHAR(64) REFERENCES opportunities(opportunity_id),
  name VARCHAR(512),
  document_type documenttype,
  url VARCHAR(1024),
  version VARCHAR(32),
  publication_date TIMESTAMPTZ,
  hash VARCHAR(128),
  storage_path VARCHAR(512),
  downloaded_at TIMESTAMPTZ
);
create index idx_documents_opportunity on documents(opportunity_id);

create table requirements (
  requirement_id VARCHAR(64) PRIMARY KEY,
  opportunity_id VARCHAR(64) REFERENCES opportunities(opportunity_id),
  category VARCHAR(64),
  subcategory VARCHAR(128),
  requirement_text TEXT,
  mandatory BOOLEAN DEFAULT true,
  threshold VARCHAR(256),
  applies_to VARCHAR(128),
  evidence_required TEXT,
  phase VARCHAR(64),
  document VARCHAR(512),
  section VARCHAR(128),
  page INTEGER,
  source_url VARCHAR(1024),
  confidence confidencelevel DEFAULT 'UNCLEAR'
);
create index idx_requirements_opportunity on requirements(opportunity_id);
create index idx_requirements_category on requirements(category);

create table team_requirements (
  id SERIAL PRIMARY KEY,
  opportunity_id VARCHAR(64) REFERENCES opportunities(opportunity_id),
  role VARCHAR(128),
  number_required INTEGER DEFAULT 1,
  education VARCHAR(256),
  certifications JSONB DEFAULT '[]',
  general_experience_years INTEGER DEFAULT 0,
  specific_experience_years INTEGER DEFAULT 0,
  required_project_types JSONB DEFAULT '[]',
  technologies JSONB DEFAULT '[]',
  languages JSONB DEFAULT '[]',
  security_clearance VARCHAR(64),
  allocation_percent FLOAT,
  onsite_requirement VARCHAR(64),
  mandatory BOOLEAN DEFAULT true
);
create index idx_team_req_opportunity on team_requirements(opportunity_id);

create table reference_requirements (
  id SERIAL PRIMARY KEY,
  opportunity_id VARCHAR(64) REFERENCES opportunities(opportunity_id),
  number_of_references INTEGER DEFAULT 0,
  minimum_contract_value FLOAT,
  currency VARCHAR(8),
  minimum_duration INTEGER,
  reference_period VARCHAR(64),
  sector VARCHAR(128),
  technology VARCHAR(256),
  geography VARCHAR(128),
  minimum_users INTEGER,
  minimum_countries INTEGER,
  large_scale_required BOOLEAN DEFAULT false,
  public_sector_required BOOLEAN DEFAULT false,
  cross_border_required BOOLEAN DEFAULT false,
  evidence_required TEXT
);
create index idx_ref_req_opportunity on reference_requirements(opportunity_id);

create table award_criteria (
  id SERIAL PRIMARY KEY,
  opportunity_id VARCHAR(64) REFERENCES opportunities(opportunity_id),
  criterion VARCHAR(256),
  weight FLOAT,
  subcriteria JSONB DEFAULT '[]'
);
create index idx_award_criteria_opportunity on award_criteria(opportunity_id);

create table opportunity_snapshots (
  id SERIAL PRIMARY KEY,
  opportunity_id VARCHAR(64) REFERENCES opportunities(opportunity_id),
  checked_at TIMESTAMPTZ DEFAULT now(),
  deadline TIMESTAMPTZ,
  status VARCHAR(64),
  value VARCHAR(64),
  document_hashes JSONB DEFAULT '[]',
  requirements_hash VARCHAR(128)
);
create index idx_snapshots_opportunity on opportunity_snapshots(opportunity_id);

create table change_events (
  id SERIAL PRIMARY KEY,
  opportunity_id VARCHAR(64) REFERENCES opportunities(opportunity_id),
  event_type VARCHAR(64),
  importance changeimportance,
  description TEXT,
  detected_at TIMESTAMPTZ DEFAULT now()
);
create index idx_change_events_opportunity on change_events(opportunity_id);
create index idx_change_events_importance on change_events(importance);

create table requirement_matches (
  id SERIAL PRIMARY KEY,
  requirement_id VARCHAR(64) REFERENCES requirements(requirement_id),
  match_status matchstatus DEFAULT 'UNKNOWN',
  matched_evidence TEXT,
  notes TEXT
);
create index idx_req_matches_requirement on requirement_matches(requirement_id);

create table partners (
  id SERIAL PRIMARY KEY,
  organisation_id VARCHAR(64) REFERENCES organisations(org_id),
  role_needed VARCHAR(64),
  opportunity_id VARCHAR(64) REFERENCES opportunities(opportunity_id),
  status VARCHAR(64)
);

create table company_capabilities (
  id SERIAL PRIMARY KEY,
  field_name VARCHAR(128),
  value JSONB,
  verified_at TIMESTAMPTZ,
  source VARCHAR(512)
);

create table digest_entries (
  id SERIAL PRIMARY KEY,
  digest_date TIMESTAMPTZ DEFAULT now(),
  digest_type VARCHAR(16),
  opportunity_id VARCHAR(64) REFERENCES opportunities(opportunity_id),
  section VARCHAR(64),
  content TEXT
);
create index idx_digest_date on digest_entries(digest_date);

create table agent_runs (
  run_id VARCHAR(64) PRIMARY KEY,
  agent_name VARCHAR(64),
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  query TEXT,
  url VARCHAR(1024),
  retrieved_content_ref VARCHAR(512),
  model VARCHAR(64),
  prompt_version VARCHAR(32),
  analysis_version VARCHAR(32),
  status VARCHAR(32) DEFAULT 'RUNNING',
  error TEXT
);

-- News / social monitoring ----------------------------------------------------

create table news_items (
  news_id VARCHAR(64) PRIMARY KEY,
  title TEXT NOT NULL,
  category VARCHAR(32),
  region VARCHAR(64),
  country VARCHAR(4),
  published_date TIMESTAMPTZ,
  source_name VARCHAR(256),
  source_url VARCHAR(1024),
  excerpt TEXT,
  summary TEXT,
  impact_note TEXT,
  relevance_score INTEGER,
  unverified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
create index idx_news_category on news_items(category);
create index idx_news_published on news_items(published_date);

create table tracked_accounts (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(16),
  handle_or_url VARCHAR(512),
  display_name VARCHAR(256),
  category VARCHAR(64),
  active BOOLEAN DEFAULT false
);

-- ============================================================================
-- Row Level Security (Supabase-specific)
--
-- By default Supabase exposes tables via its auto-generated REST API to
-- anyone with the anon key unless RLS is enabled. Since this dashboard is
-- an internal tool, the simplest safe setup:
--   1. Enable RLS on every table.
--   2. Allow full access to service_role (used server-side / GitHub Action),
--      read-only to authenticated users.
--
-- alter table opportunities enable row level security;
-- create policy "service role full access" on opportunities
--   for all using (auth.role() = 'service_role');
-- create policy "authenticated read" on opportunities
--   for select using (auth.role() = 'authenticated');
--
-- Do NOT leave RLS disabled with the anon key exposed in a public
-- frontend build.
-- ============================================================================

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

-- Everything reaches the platform in English: an English title next to the
-- original-language one, plus the source language. source_activity also
-- records what triage found an item to be, for the Live activity wording.
alter table opportunities add column if not exists title_en text;
alter table opportunities add column if not exists language varchar(8);
alter table news_items add column if not exists title_en text;
alter table news_items add column if not exists language varchar(8);
alter table source_activity add column if not exists title_en text;
alter table source_activity add column if not exists kind varchar(32);   -- triage type: TENDER, RFI, GRANT, NEWS_ONLY…

-- Update notes: what a change notice says it changed (reason, description,
-- documents changed) in its own language, and an English note written from it
-- — shown as a comment under the opportunity.
alter table change_events add column if not exists notice_url text;
alter table change_events add column if not exists note_source text;   -- TED's own text, original language
alter table change_events add column if not exists note text;          -- English comment (agents/translator.py)

-- Buyer names in English: the official name plus an English rendering in
-- parentheses when it isn't English (agents/translator.py; new items from triage).
alter table opportunities add column if not exists authority_en text;

-- Share image of each news story (og:image / twitter:image of the source page),
-- shown on the News page cards. image_checked_at marks pages already looked at.
alter table news_items add column if not exists image_url text;
alter table news_items add column if not exists image_checked_at timestamptz;

-- News analyst agent output (agents/news_analyst.py): a complete summary of
-- the story, key facts, and what WalliD should do about it.
alter table news_items add column if not exists summary_long text;
alter table news_items add column if not exists key_facts jsonb;
alter table news_items add column if not exists analysis jsonb;      -- {verdict, take, actions:[{type,title,why,next_step,deadline,priority}]}
alter table news_items add column if not exists analysed_at timestamptz;

-- The News Report Agent runs when a news page is first opened: a lock so two
-- visitors don't start two runs, and the last error to show on the page.
alter table news_items add column if not exists report_started_at timestamptz;
alter table news_items add column if not exists report_error text;

-- English names for tender documents (file names are in the buyer's language).
alter table documents add column if not exists name_en text;
-- Tender Analysis agent: an English summary of the tender and each
-- requirement's group (eligibility / references / human resources / technical).
alter table opportunities add column if not exists tender_summary text;
alter table opportunities add column if not exists tender_analysed_at timestamptz;
alter table requirements add column if not exists requirement_group text;  -- ELIGIBILITY | REFERENCES | HUMAN_RESOURCES | TECHNICAL
-- Evaluation Report Agent (run from the opportunity page): WalliD's fit
-- against the requirements, with a lock so two clicks share one run.
alter table opportunities add column if not exists evaluation jsonb;      -- {fit_score, verdict, take, strengths, gaps, partners, next_steps}
alter table opportunities add column if not exists evaluated_at timestamptz;
alter table opportunities add column if not exists evaluation_started_at timestamptz;
alter table opportunities add column if not exists evaluation_error text;
-- Settings page: the company, what the radar searches for, and the agents.
create table if not exists app_settings (
  key text primary key,            -- 'company' | 'search'
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
-- company: {name, context}
-- search:  {scope (the user's text), config (the Config Agent's parse: ted_phrases,
--           web_queries, news_queries, site_query, relevance_rubric), status, error, parsed_at}

create table if not exists agent_settings (
  agent_key text primary key,      -- see webapp/lib/agents.ts
  enabled boolean not null default true,
  instructions text,               -- the user's fine-tuning, in plain language
  prompt_override text,            -- the Config Agent's rewrite of the default prompt
  default_prompt text,             -- synced from the repo by the pipeline
  status text,                     -- 'applied' | 'error'
  error text,
  updated_at timestamptz default now()
);

-- Company material for the agents (presentations, references, CVs): the file
-- sits in the private 'company-files' storage bucket, its text here.
create table if not exists company_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null,              -- 'presentation' | 'reference' | 'cv' | 'other'
  name text not null,
  storage_path text not null,
  size_bytes integer,
  text_content text,
  chars integer,
  uploaded_at timestamptz default now()
);
alter table app_settings enable row level security;
alter table agent_settings enable row level security;
alter table company_documents enable row level security;
-- Proposal Manager Agent (button in the tender page's evaluation section):
-- the proposal brief it writes (Markdown), when, and a lock for the run.
alter table opportunities add column if not exists proposal_brief text;
alter table opportunities add column if not exists proposal_at timestamptz;
alter table opportunities add column if not exists proposal_started_at timestamptz;
alter table opportunities add column if not exists proposal_error text;
-- Platform language (the Translator Agent's "Target language"): which language
-- each displayed text column is in, so a language change re-translates /
-- rewrites exactly what's out of date. {column: language code}
alter table opportunities add column if not exists lang jsonb not null default '{}'::jsonb;
alter table news_items add column if not exists lang jsonb not null default '{}'::jsonb;
alter table documents add column if not exists lang jsonb not null default '{}'::jsonb;
alter table source_activity add column if not exists lang jsonb not null default '{}'::jsonb;
alter table change_events add column if not exists lang jsonb not null default '{}'::jsonb;
alter table feed_posts add column if not exists lang jsonb not null default '{}'::jsonb;
-- Everything written so far is English.
update opportunities set lang = jsonb_strip_nulls(jsonb_build_object(
  'title_en', case when title_en is not null then 'en' end, 'authority_en', case when authority_en is not null then 'en' end,
  'summary', case when summary is not null then 'en' end)) where lang = '{}'::jsonb;
update news_items set lang = jsonb_strip_nulls(jsonb_build_object(
  'title_en', case when title_en is not null then 'en' end, 'summary', case when summary is not null then 'en' end)) where lang = '{}'::jsonb;
update documents set lang = jsonb_build_object('name_en', 'en') where name_en is not null and lang = '{}'::jsonb;
update source_activity set lang = jsonb_build_object('title_en', 'en') where title_en is not null and lang = '{}'::jsonb;
update change_events set lang = jsonb_build_object('note', 'en') where note is not null and lang = '{}'::jsonb;
update feed_posts set lang = jsonb_build_object('post', 'en') where lang = '{}'::jsonb;
-- Accounts (Supabase Auth) and the social layer: profiles, likes ("Following"
-- on the profile), and the posts / comments tables the social feed will use.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  display_name text,
  avatar_url text,
  bio text,                         -- "About", written by the user
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_username_lower on profiles (lower(username));

create table if not exists likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('tender', 'news')),
  item_id text not null,            -- opportunities.opportunity_id / news_items.news_id
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);
create index if not exists likes_item on likes (item_type, item_id);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  score integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  body text not null,
  score integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists posts_user on posts (user_id, created_at desc);
create index if not exists comments_user on comments (user_id, created_at desc);

alter table profiles enable row level security;
alter table likes enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
-- Posts can be about a tender or a news story.
alter table posts add column if not exists item_type text check (item_type in ('tender', 'news'));
alter table posts add column if not exists item_id text;

-- Notifications (the navbar bell).
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,             -- chat_request | chat_accepted | comment | tender_update
  actor_id uuid references auth.users(id) on delete set null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user on notifications (user_id, created_at desc);

-- Chat: a conversation between members; the person asked starts as 'pending'
-- (a chat request) until they accept.
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create table if not exists conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted', 'declined')),
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists conversation_members_user on conversation_members (user_id);
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation on messages (conversation_id, created_at);

-- A new update on a tender (deadline change, clarification…) notifies everyone following it.
create or replace function notify_tender_followers() returns trigger language plpgsql security definer as $$
begin
  insert into notifications (user_id, type, title, body, link)
  select l.user_id, 'tender_update', 'Update on a tender you follow', left(new.description, 300), '/tenders/' || new.opportunity_id
  from likes l where l.item_type = 'tender' and l.item_id = new.opportunity_id;
  return new;
end $$;
drop trigger if exists change_events_notify on change_events;
create trigger change_events_notify after insert on change_events for each row execute function notify_tender_followers();

alter table notifications enable row level security;
alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table messages enable row level security;
