-- Settings: who may send you chat requests.
alter table profiles add column if not exists chat_permission text not null default 'everyone'
  check (chat_permission in ('everyone', 'workspace', 'nobody'));
