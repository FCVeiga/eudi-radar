-- Notification preferences per user: {likes, comments, replies, new_tender, tender_update, follows} → true/false (missing = on).
alter table profiles add column if not exists notification_prefs jsonb not null default '{}'::jsonb;
create index if not exists notifications_unread on notifications (user_id) where read_at is null;

-- A tender that becomes open (the pipeline's verification confirms it) is a new
-- tender under the Search Agent's scope: notify everyone who wants those.
create or replace function notify_new_tender() returns trigger language plpgsql security definer as $$
begin
  if new.status = 'OPEN' and coalesce(new.opportunity_type, '') <> 'signal'
     and (tg_op = 'INSERT' or old.status is distinct from 'OPEN')
     and (new.deadline is null or new.deadline >= now()) then
    insert into notifications (user_id, type, title, body, link)
    select p.id, 'new_tender', 'New tender: ' || left(coalesce(new.title_en, new.title), 200),
           left(coalesce(new.summary, ''), 280), '/tenders/' || new.opportunity_id
    from profiles p where coalesce((p.notification_prefs->>'new_tender')::boolean, true);
  end if;
  return new;
end $$;
drop trigger if exists opportunities_notify_new on opportunities;
create trigger opportunities_notify_new after insert or update of status on opportunities for each row execute function notify_new_tender();

-- Tender updates respect the same preferences.
create or replace function notify_tender_followers() returns trigger language plpgsql security definer as $$
begin
  insert into notifications (user_id, type, title, body, link)
  select l.user_id, 'tender_update', 'Update on a tender you follow', left(new.description, 300), '/tenders/' || new.opportunity_id
  from likes l join profiles p on p.id = l.user_id
  where l.item_type = 'tender' and l.item_id = new.opportunity_id
    and coalesce((p.notification_prefs->>'tender_update')::boolean, true);
  return new;
end $$;
