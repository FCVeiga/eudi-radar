-- Threaded comments (replies), comments on news, likes on comments,
-- reposts, hiding items, and reports.
alter table comments add column if not exists parent_id uuid references comments(id) on delete cascade;
alter table comments add column if not exists item_type text not null default 'post';
alter table comments add column if not exists item_id text;
alter table comments add column if not exists like_count integer not null default 0;
alter table comments alter column post_id drop not null;
update comments set item_id = post_id::text where item_id is null and post_id is not null;
alter table comments drop constraint if exists comments_item_type_check;
alter table comments add constraint comments_item_type_check check (item_type in ('post', 'news', 'tender'));
create index if not exists comments_item on comments (item_type, item_id, created_at);

alter table likes drop constraint if exists likes_item_type_check;
alter table likes add constraint likes_item_type_check check (item_type in ('tender', 'news', 'post', 'comment'));
create or replace function sync_post_like_count() returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    if new.item_type = 'post' then update posts set like_count = like_count + 1 where id::text = new.item_id;
    elsif new.item_type = 'comment' then update comments set like_count = like_count + 1 where id::text = new.item_id; end if;
  elsif tg_op = 'DELETE' then
    if old.item_type = 'post' then update posts set like_count = greatest(like_count - 1, 0) where id::text = old.item_id;
    elsif old.item_type = 'comment' then update comments set like_count = greatest(like_count - 1, 0) where id::text = old.item_id; end if;
  end if;
  return null;
end $$;

create table if not exists reposts (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('post', 'news', 'tender')),
  item_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);
create index if not exists reposts_item on reposts (item_type, item_id);

create table if not exists hidden_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null,
  item_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  item_type text not null,
  item_id text not null,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
alter table reposts enable row level security;
alter table hidden_items enable row level security;
alter table reports enable row level security;
