-- A sealed copy of the bearer token, so Workspaces can show a mask and copy a
-- link that already includes it. The hash stays the only value used to sign in.
-- Readable by the service role only (row level security, no policies).

alter table mcp_tokens add column if not exists token_secret text;

notify pgrst, 'reload schema';
