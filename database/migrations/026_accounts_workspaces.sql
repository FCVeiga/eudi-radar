-- Accounts, plans, team members and workspaces.
--   account   — personal (Free / Starter / Pro) or team (Teams); the platform
--               account holds the default scope everyone on Free sees
--   workspace — belongs to an account; holds scopes
--   members   — team accounts: admins configure, members see the results
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('personal', 'team', 'platform')),
  name text not null,
  owner_id uuid references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro', 'teams')),
  plan_status text not null default 'active',     -- active | trialing | past_due | canceled | comped
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists accounts_personal_owner on accounts (owner_id) where kind = 'personal';

create table if not exists account_members (
  account_id uuid not null references accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);
create index if not exists account_members_user on account_members (user_id);

create table if not exists account_invites (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  email text,
  role text not null default 'member' check (role in ('admin', 'member')),
  token text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz
);

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists workspaces_account on workspaces (account_id);

alter table scopes add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table scopes add column if not exists last_run_at timestamptz;    -- the pipeline's cadence per plan
alter table profiles add column if not exists current_workspace_id uuid references workspaces(id) on delete set null;
alter table profiles add column if not exists is_platform_admin boolean not null default false;

alter table accounts enable row level security;
alter table account_members enable row level security;
alter table account_invites enable row level security;
alter table workspaces enable row level security;

do $$
declare platform uuid; pws uuid; acc uuid; ws uuid; p record; first_user uuid;
begin
  if exists (select 1 from accounts) then return; end if;
  select id into first_user from profiles order by created_at limit 1;
  -- The platform account: the default scope (what Free users and visitors see).
  insert into accounts (kind, name, owner_id, plan, plan_status) values ('platform', 'EUDI Radar', first_user, 'teams', 'comped') returning id into platform;
  insert into workspaces (account_id, name, created_by) values (platform, 'Default', first_user) returning id into pws;
  update scopes set workspace_id = pws where is_default;
  if first_user is not null then
    insert into account_members (account_id, user_id, role) values (platform, first_user, 'admin');
    update profiles set is_platform_admin = true where id = first_user;
  end if;
  -- A personal account and workspace for everyone.
  for p in select id, username from profiles loop
    insert into accounts (kind, name, owner_id, plan, plan_status)
    values ('personal', p.username, p.id, case when p.id = first_user then 'pro' else 'free' end, case when p.id = first_user then 'comped' else 'active' end)
    returning id into acc;
    insert into account_members (account_id, user_id, role) values (acc, p.id, 'admin');
    insert into workspaces (account_id, name, created_by) values (acc, 'My workspace', p.id) returning id into ws;
    update scopes set workspace_id = ws where owner_id = p.id and workspace_id is null;
    update profiles set current_workspace_id = case when p.id = first_user then pws else ws end where id = p.id;
  end loop;
end $$;
