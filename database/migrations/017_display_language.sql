-- Platform language (the Translator Agent's "Target language"): which language
-- each displayed text column is in, so a language change re-translates /
-- rewrites exactly what's out of date. {column: language code}
alter table opportunities add column if not exists lang jsonb not null default '{}'::jsonb;
alter table news_items add column if not exists lang jsonb not null default '{}'::jsonb;
alter table documents add column if not exists lang jsonb not null default '{}'::jsonb;
alter table source_activity add column if not exists lang jsonb not null default '{}'::jsonb;
alter table change_events add column if not exists lang jsonb not null default '{}'::jsonb;
alter table feed_posts add column if not exists lang jsonb not null default '{}'::jsonb;
-- Everything written so far is English.
update opportunities set lang = jsonb_strip_nulls(jsonb_build_object(
  'title_en', case when title_en is not null then 'en' end, 'authority_en', case when authority_en is not null then 'en' end,
  'summary', case when summary is not null then 'en' end)) where lang = '{}'::jsonb;
update news_items set lang = jsonb_strip_nulls(jsonb_build_object(
  'title_en', case when title_en is not null then 'en' end, 'summary', case when summary is not null then 'en' end)) where lang = '{}'::jsonb;
update documents set lang = jsonb_build_object('name_en', 'en') where name_en is not null and lang = '{}'::jsonb;
update source_activity set lang = jsonb_build_object('title_en', 'en') where title_en is not null and lang = '{}'::jsonb;
update change_events set lang = jsonb_build_object('note', 'en') where note is not null and lang = '{}'::jsonb;
update feed_posts set lang = jsonb_build_object('post', 'en') where lang = '{}'::jsonb;
