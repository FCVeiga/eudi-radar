-- Posts can be about a tender or a news story.
alter table posts add column if not exists item_type text check (item_type in ('tender', 'news'));
alter table posts add column if not exists item_id text;

-- Notifications (the navbar bell).
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,             -- chat_request | chat_accepted | comment | tender_update
  actor_id uuid references auth.users(id) on delete set null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user on notifications (user_id, created_at desc);

-- Chat: a conversation between members; the person asked starts as 'pending'
-- (a chat request) until they accept.
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create table if not exists conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted', 'declined')),
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists conversation_members_user on conversation_members (user_id);
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation on messages (conversation_id, created_at);

-- A new update on a tender (deadline change, clarification…) notifies everyone following it.
create or replace function notify_tender_followers() returns trigger language plpgsql security definer as $$
begin
  insert into notifications (user_id, type, title, body, link)
  select l.user_id, 'tender_update', 'Update on a tender you follow', left(new.description, 300), '/tenders/' || new.opportunity_id
  from likes l where l.item_type = 'tender' and l.item_id = new.opportunity_id;
  return new;
end $$;
drop trigger if exists change_events_notify on change_events;
create trigger change_events_notify after insert on change_events for each row execute function notify_tender_followers();

alter table notifications enable row level security;
alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table messages enable row level security;
