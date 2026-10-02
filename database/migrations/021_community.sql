-- Community Feed: posts get tags and media; posts can be liked; users follow users.
alter table posts add column if not exists tags text[] not null default '{}';
alter table posts add column if not exists media jsonb not null default '[]'::jsonb;   -- [{type: image|video, url, path}]
alter table posts add column if not exists like_count integer not null default 0;
create index if not exists posts_created on posts (created_at desc);
create index if not exists posts_tags on posts using gin (tags);

alter table likes drop constraint if exists likes_item_type_check;
alter table likes add constraint likes_item_type_check check (item_type in ('tender', 'news', 'post'));

-- Keep posts.like_count in step with likes.
create or replace function sync_post_like_count() returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' and new.item_type = 'post' then
    update posts set like_count = like_count + 1 where id::text = new.item_id;
  elsif tg_op = 'DELETE' and old.item_type = 'post' then
    update posts set like_count = greatest(like_count - 1, 0) where id::text = old.item_id;
  end if;
  return null;
end $$;
drop trigger if exists likes_post_count on likes;
create trigger likes_post_count after insert or delete on likes for each row execute function sync_post_like_count();

create table if not exists user_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists user_follows_followee on user_follows (followee_id);
alter table user_follows enable row level security;
