-- Proposal Manager Agent (button in the tender page's evaluation section):
-- the proposal brief it writes (Markdown), when, and a lock for the run.
alter table opportunities add column if not exists proposal_brief text;
alter table opportunities add column if not exists proposal_at timestamptz;
alter table opportunities add column if not exists proposal_started_at timestamptz;
alter table opportunities add column if not exists proposal_error text;
