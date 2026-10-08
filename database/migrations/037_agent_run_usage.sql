-- Monthly Tender Evaluation and proposal-brief runs, counted on the workspace owner's account.
-- Starter includes 1 evaluation a month, Pro 5, Teams unlimited. Proposal briefs are Teams only.

create table if not exists agent_run_usage (
  account_id uuid not null references accounts(id) on delete cascade,
  month text not null,
  agent_key text not null,
  runs integer not null default 0,
  primary key (account_id, month, agent_key)
);

alter table agent_run_usage enable row level security;

notify pgrst, 'reload schema';
