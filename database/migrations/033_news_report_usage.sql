-- Monthly News Report Agent usage, counted on the workspace owner's account.
-- Pro includes 50 a month; Teams is unlimited and does not need a row.

create table if not exists news_report_usage (
  account_id uuid not null references accounts(id) on delete cascade,
  month text not null,
  reports integer not null default 0,
  primary key (account_id, month)
);

alter table news_report_usage enable row level security;
