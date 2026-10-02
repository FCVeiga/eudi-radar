-- English names for tender documents (file names are in the buyer's language).
alter table documents add column if not exists name_en text;
