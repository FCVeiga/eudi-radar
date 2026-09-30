-- Store full triage JSON on candidates; add a summary to opportunities.
alter table candidates add column if not exists triage_output jsonb;
alter table opportunities add column if not exists summary text;
create index if not exists idx_opportunities_type on opportunities(opportunity_type);
create index if not exists idx_news_category on news_items(category);
