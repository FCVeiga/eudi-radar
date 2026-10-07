-- General: the new default scope (visitors, new users, Free); generic, no industry.
-- EUDI Wallet & digital identity: no longer the default; gets its instructions and
-- moves to its owner's own workspace. The empty "New scope" is removed.
alter table feed_posts add column if not exists plain boolean not null default false;

delete from scopes where name = 'New scope' and not is_default
  and not exists (select 1 from scope_items i where i.scope_id = scopes.id);

update scopes set is_default = false, name = 'EUDI Wallet & digital identity', instructions = $q$Who this scope is for: WalliD, a European digital-trust company. It builds eIDAS-compliant digital identity wallets, a verifiable-credential issuer platform (issue, manage and verify digital certificates), qualified electronic signatures (QES) with eID integration, and a certified AI-dataset marketplace. API-first, SDKs, cloud-native; integrates gradually with legacy systems.

Go for:
- EUDI Wallet and national identity wallets: wallet development, PID and (Q)EAA issuance, relying-party integration, wallet certification.
- Verifiable credentials and digital credential issuance: diplomas, professional qualifications, certificates; mobile driving licence (ISO 18013-5); OpenID4VC, SD-JWT.
- Qualified electronic signatures and trust services tied to eID.
- Digital identity for public bodies, banks and regulated sectors: onboarding/KYC with wallets, identity verification, protection against impersonation and deepfake fraud.
- EU programmes, large-scale pilots and consortium calls on digital identity (Digital Europe, Horizon Europe, NGI, EBSI).

Out of scope:
- Payment or crypto wallets, generic IT outsourcing or staffing, hardware-only supply (smart cards, card printers, ID document production), cybersecurity work with no identity component, job adverts.

News that matters: eIDAS 2 implementing acts and certification, national wallet rollouts and their procurements, adopters (governments, banks, telcos) announcing wallet use, and competitor moves (funding, acquisitions, partnerships).$q$,
  workspace_id = coalesce((select w.id from workspaces w join profiles p on p.id = w.owner_id
                           where p.username = 'FCVeiga' and w.name = 'My workspace' limit 1), workspace_id),
  updated_at = now()
  where is_default and name = 'EUDI Wallet & digital identity';

insert into scopes (name, instructions, active, is_default, workspace_id, owner_id, search_scope, search_config, search_status)
select 'General', $q$General radar for everyone, across all sectors in Europe: the most significant public tenders and news.

Tenders: contract notices on TED worth at least €5M with at least 5 days to bid, ranked by contract value, the buyer's standing (EU institutions and central government first; central purchasing bodies' frameworks get a bonus), how many suppliers the market has (IT, consulting, construction, health…) and the number of lots, and time left to bid.

News: stories from the last week on public contracts, EU regulation and the companies that work with the public sector, ranked by the outlet's reputation, how many outlets report the story, and freshness.$q$, true, true, w.id, w.owner_id, null, cast($q${"mode": "generic", "topic": "General", "min_value_eur": 5000000, "lookback_days": 4, "max_tenders": 25, "min_tender_score": 55, "max_news": 15, "min_news_score": 40, "news_queries": {"market": ["largest public contracts awarded Europe", "major government tender launched", "public procurement framework agreement billion"], "regulation": ["European Commission adopts regulation", "EU public procurement rules reform", "new EU directive agreed Parliament Council"], "industry": ["European company wins government contract", "public sector technology acquisition Europe", "EU funding programme call launched"]}}$q$ as jsonb), 'applied'
from workspaces w where w.name = 'Default' and not exists (select 1 from scopes where is_default)
limit 1;

-- Default workspace's own scope list is just General now; its owner works in their own workspace.
update profiles set current_workspace_id = (select w.id from workspaces w where w.owner_id = profiles.id and w.name = 'My workspace' limit 1)
  where username = 'FCVeiga';
