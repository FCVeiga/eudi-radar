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
