-- Context files for a shared scope belong to the workspace that uploaded them.
-- The daily pipeline does not read company_documents. Tender Evaluation and the
-- Proposal Manager read a workspace's files only when that workspace runs them.

alter table company_documents add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
create index if not exists company_documents_scope_workspace on company_documents (scope_id, workspace_id);

alter table scope_evaluations add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table scope_evaluations add column if not exists id uuid default gen_random_uuid();
update scope_evaluations set id = gen_random_uuid() where id is null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'scope_evaluations'::regclass and contype = 'p' and conname = 'scope_evaluations_pkey'
      and pg_get_constraintdef(oid) like '%scope_id%'
  ) then
    alter table scope_evaluations drop constraint scope_evaluations_pkey;
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid = 'scope_evaluations'::regclass and contype = 'p'
  ) then
    alter table scope_evaluations alter column id set not null;
    alter table scope_evaluations add primary key (id);
  end if;
end $$;

create unique index if not exists scope_evaluations_shared_key
  on scope_evaluations (scope_id, opportunity_id) where workspace_id is null;
create unique index if not exists scope_evaluations_workspace_key
  on scope_evaluations (scope_id, opportunity_id, workspace_id) where workspace_id is not null;

alter table requirement_matches add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
create index if not exists requirement_matches_scope_workspace on requirement_matches (scope_id, workspace_id);

notify pgrst, 'reload schema';
