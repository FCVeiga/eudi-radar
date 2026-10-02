-- Profile card banner image (public 'avatars' bucket, path <user>/banner-*).
alter table profiles add column if not exists banner_url text;
