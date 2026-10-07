-- Per-workspace choice to hide the shared default scope, and a monthly count of
-- tender pages opened (the requirements limit on Free and Starter).

alter table workspaces add column if not exists show_default boolean not null default true;

create table if not exists tender_page_views (
  user_id uuid not null references profiles(id) on delete cascade,
  month text not null,
  views integer not null default 0,
  primary key (user_id, month)
);

alter table tender_page_views enable row level security;
