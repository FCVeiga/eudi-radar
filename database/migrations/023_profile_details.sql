-- Profile details (About tab and profile card): work, expertise and social links.
alter table profiles add column if not exists company text;
alter table profiles add column if not exists role text;
alter table profiles add column if not exists location text;
alter table profiles add column if not exists expertise text[] not null default '{}';
alter table profiles add column if not exists website_url text;
alter table profiles add column if not exists linkedin_url text;
alter table profiles add column if not exists x_url text;
alter table profiles add column if not exists github_url text;

-- One-off: counts for likes made before the like_count trigger existed.
update posts p set like_count = (select count(*) from likes l where l.item_type = 'post' and l.item_id = p.id::text);
update comments m set like_count = (select count(*) from likes l where l.item_type = 'comment' and l.item_id = m.id::text);
