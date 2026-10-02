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
