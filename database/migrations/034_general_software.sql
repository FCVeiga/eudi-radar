-- General: software-development tenders, grants and news. Select the scope by id.
do $$
declare
  n int;
  sid uuid := '0559b24a-3207-470d-ad7b-b5837f2e3d7b';
  eudi uuid := '0d315fdb-92b2-402e-a9b9-dd96b6976667';
begin
  select count(*) into n from scopes where id = sid and name = 'General' and is_default;
  if n <> 1 then
    raise exception 'General scope not found (count %)', n;
  end if;

  update scopes set
    instructions = $txt$General radar for companies looking for software development work in the European public market: open tenders, grant calls, and the news around that market.

Tenders: TED contract notices whose work is software — software packages and information systems, or software programming and consultancy — worth at least €1 million, with at least 5 days left to bid. Ranked by contract value, the buyer (EU institutions and central government first), and time left.

News and grants: stories and calls from the last week on public software contracts, Digital Europe and Horizon digital calls, and software companies winning public work. A story has to be about software, a digital system, or a grant a software company could bid for.$txt$,
    search_config = jsonb_build_object(
      'mode', 'generic',
      'topic', 'General',
      'max_news', 15,
      'max_tenders', 25,
      'lookback_days', 4,
      'min_value_eur', 1000000,
      'min_news_score', 55,
      'min_tender_score', 55,
      'news_queries', jsonb_build_object(
        'market', jsonb_build_array(
          'EU public tender software development',
          'government software contract awarded Europe',
          'framework agreement software services Europe'),
        'regulation', jsonb_build_array(
          'EU software procurement rules',
          'Interoperable Europe public sector software',
          'EU digital government regulation software'),
        'industry', jsonb_build_array(
          'Digital Europe Programme call for proposals',
          'Horizon Europe digital call for proposals',
          'European software company public sector contract')
      )
    )
  where id = sid and name = 'General';

  delete from scope_sources
  where scope_id = sid
    and source_id in ('GEN-001','GEN-002','GEN-003','GEN-004','GEN-005','GEN-006','GEN-007','GEN-008','GEN-009','GEN-010');

  insert into sources (source_id, name, source_type, url, feed_url, handle, method, enabled, check_every_days, status, priority, rss_available, country) values
    ('GEN-011', 'Computer Weekly', 'NEWS', 'https://www.computerweekly.com', 'https://www.computerweekly.com/rss/All-Computer-Weekly-content.xml', null, 'rss', true, 1, 'ACTIVE', 2, true, null),
    ('GEN-012', 'The Register', 'NEWS', 'https://www.theregister.com', 'https://www.theregister.com/headlines.atom', null, 'rss', true, 1, 'ACTIVE', 2, true, null),
    ('GEN-013', 'Sifted', 'NEWS', 'https://sifted.eu', 'https://sifted.eu/feed', null, 'rss', true, 1, 'ACTIVE', 2, true, null),
    ('GEN-014', 'Digital Strategy', 'EU_PROGRAMME', 'https://digital-strategy.ec.europa.eu/en', 'https://digital-strategy.ec.europa.eu/en/rss.xml', null, 'rss', true, 1, 'ACTIVE', 2, true, null),
    ('GEN-015', 'EU Funding & Tenders Portal', 'FUNDING_PORTAL', 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/', null, null, 'site_search', true, 2, 'ACTIVE', 2, false, null),
    ('GEN-016', 'HaDEA', 'EU_PROGRAMME', 'https://hadea.ec.europa.eu/news_en', null, null, 'site_search', true, 2, 'ACTIVE', 2, false, null),
    ('GEN-017', 'European Innovation Council', 'EU_PROGRAMME', 'https://eic.ec.europa.eu/news_en', null, null, 'site_search', true, 2, 'ACTIVE', 2, false, null),
    ('GEN-018', 'CORDIS', 'FUNDING_PORTAL', 'https://cordis.europa.eu/news', null, null, 'site_search', true, 2, 'ACTIVE', 2, false, null),
    ('GEN-019', 'Interoperable Europe', 'DIGITAL_AGENCY', 'https://interoperable-europe.ec.europa.eu', null, null, 'site_search', true, 2, 'ACTIVE', 2, false, null)
  on conflict (source_id) do update set
    name = excluded.name,
    source_type = excluded.source_type,
    url = excluded.url,
    feed_url = excluded.feed_url,
    method = excluded.method,
    enabled = excluded.enabled,
    check_every_days = excluded.check_every_days,
    rss_available = excluded.rss_available;

  insert into scope_sources (scope_id, source_id)
  select sid, src.source_id from sources src
  where src.source_id in ('GEN-011','GEN-012','GEN-013','GEN-014','GEN-015','GEN-016','GEN-017','GEN-018','GEN-019')
  on conflict do nothing;

  select count(*) into n from scope_sources
  where scope_id = sid and source_id in ('GEN-001','GEN-002','GEN-003','GEN-004','GEN-005','GEN-006','GEN-007','GEN-008','GEN-009','GEN-010');
  if n <> 0 then
    raise exception 'old General follows remain (%)', n;
  end if;

  select count(*) into n from scope_sources
  where scope_id = sid and source_id in ('GEN-011','GEN-012','GEN-013','GEN-014','GEN-015','GEN-016','GEN-017','GEN-018','GEN-019');
  if n <> 9 then
    raise exception 'expected 9 software follows, got %', n;
  end if;

  select count(*) into n from scope_sources
  where scope_id = eudi and source_id in ('EU-002','EU-004','EU-005','EU-006');
  if n <> 4 then
    raise exception 'EUDI follows changed (%)', n;
  end if;

  select count(*) into n from scopes where id = sid and search_config->>'min_value_eur' = '1000000' and search_config->>'min_news_score' = '55';
  if n <> 1 then
    raise exception 'General search config was not updated';
  end if;
end $$;
