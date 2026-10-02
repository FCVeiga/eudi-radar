-- Accounts (Supabase Auth) and the social layer: profiles, likes ("Following"
-- on the profile), and the posts / comments tables the social feed will use.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  display_name text,
  avatar_url text,
  bio text,                         -- "About", written by the user
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_username_lower on profiles (lower(username));

create table if not exists likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('tender', 'news')),
  item_id text not null,            -- opportunities.opportunity_id / news_items.news_id
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);
create index if not exists likes_item on likes (item_type, item_id);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  score integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  body text not null,
  score integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists posts_user on posts (user_id, created_at desc);
create index if not exists comments_user on comments (user_id, created_at desc);

alter table profiles enable row level security;
alter table likes enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
