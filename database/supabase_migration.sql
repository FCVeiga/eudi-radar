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
