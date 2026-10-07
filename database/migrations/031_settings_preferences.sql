-- Settings: account details, discoverability and display preferences.
alter table profiles add column if not exists birthday date;
alter table profiles add column if not exists gender text check (gender in ('woman', 'man', 'non_binary', 'other', 'prefer_not')) ;
alter table profiles add column if not exists searchable boolean not null default true;
alter table profiles add column if not exists ui_language text not null default 'en' check (ui_language in ('en', 'pt', 'es', 'fr', 'de', 'it'));
alter table profiles add column if not exists theme text not null default 'auto' check (theme in ('light', 'dark', 'auto'));
