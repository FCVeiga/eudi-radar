-- Update notes: what a change notice says it changed (reason, description,
-- documents changed) in its own language, and an English note written from it
-- — shown as a comment under the opportunity.
alter table change_events add column if not exists notice_url text;
alter table change_events add column if not exists note_source text;   -- TED's own text, original language
alter table change_events add column if not exists note text;          -- English comment (agents/translator.py)
