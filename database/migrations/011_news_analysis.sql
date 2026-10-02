-- News analyst agent output (agents/news_analyst.py): a complete summary of
-- the story, key facts, and what WalliD should do about it.
alter table news_items add column if not exists summary_long text;
alter table news_items add column if not exists key_facts jsonb;
alter table news_items add column if not exists analysis jsonb;      -- {verdict, take, actions:[{type,title,why,next_step,deadline,priority}]}
alter table news_items add column if not exists analysed_at timestamptz;
