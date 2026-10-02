-- Everything reaches the platform in English: an English title next to the
-- original-language one, plus the source language. source_activity also
-- records what triage found an item to be, for the Live activity wording.
alter table opportunities add column if not exists title_en text;
alter table opportunities add column if not exists language varchar(8);
alter table news_items add column if not exists title_en text;
alter table news_items add column if not exists language varchar(8);
alter table source_activity add column if not exists title_en text;
alter table source_activity add column if not exists kind varchar(32);   -- triage type: TENDER, RFI, GRANT, NEWS_ONLY…
