-- Simpler model: everyone has a personal account (with the plan); workspaces
-- belong to a user, and members are added per workspace (owner on Teams).
alter table workspaces add column if not exists owner_id uuid references auth.users(id) on delete cascade;
update workspaces w set owner_id = coalesce(a.owner_id, w.created_by) from accounts a where a.id = w.account_id and w.owner_id is null;

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user on workspace_members (user_id);
insert into workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role from workspaces w join account_members m on m.account_id = w.account_id
on conflict do nothing;
insert into workspace_members (workspace_id, user_id, role)
select id, owner_id, 'admin' from workspaces where owner_id is not null
on conflict (workspace_id, user_id) do update set role = 'admin';

alter table account_invites add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table workspace_members enable row level security;

-- Data fix (2026-10-07): Mobile ID moved to its owner's personal account; owner on Teams (complimentary).
