-- Bearer tokens for the MCP server. External agents send one and then act as that user.
-- Only the hash is stored. The token itself is shown once, when it is created.

create table if not exists mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists mcp_tokens_user on mcp_tokens (user_id, created_at desc);

alter table mcp_tokens enable row level security;

notify pgrst, 'reload schema';
