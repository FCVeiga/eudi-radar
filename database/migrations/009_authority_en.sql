-- Buyer names in English: the official name plus an English rendering in
-- parentheses when it isn't English (agents/translator.py; new items from triage).
alter table opportunities add column if not exists authority_en text;
