-- Status verification: when an opportunity's open/closed status was last
-- checked against its source, and the evidence it rests on.
alter table opportunities add column if not exists verified_at timestamptz;
alter table opportunities add column if not exists status_evidence text;
create index if not exists idx_opportunities_status on opportunities(status);
