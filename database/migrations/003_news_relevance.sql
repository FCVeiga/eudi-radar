-- News items get an AI importance score (0-100) so they rank in the home
-- feed on the same scale as opportunities' relevance.
alter table news_items add column if not exists relevance_score integer;
