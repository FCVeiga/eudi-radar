-- Ready-made scopes shown on every workspace, next to General.
-- Turning one on is per workspace (workspace_scope_picks) and counts toward the plan.
-- General stays the only is_default scope. Select scopes by id.
alter table scopes add column if not exists catalog boolean not null default false;

create table if not exists workspace_scope_picks (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  scope_id uuid not null references scopes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, scope_id)
);

alter table workspace_scope_picks enable row level security;

do $$
declare
  n int;
  platform uuid := 'adfd1ad4-e071-4097-a57f-4eadad891e13';
  eudi uuid := '0d315fdb-92b2-402e-a9b9-dd96b6976667';
  fc uuid := '9f90e981-8ae3-47ce-ab6b-128fce8687c2';
begin
  select count(*) into n from scopes where id = '0559b24a-3207-470d-ad7b-b5837f2e3d7b' and name = 'General' and is_default;
  if n <> 1 then
    raise exception 'General scope not found (count %)', n;
  end if;

  select count(*) into n from scopes where id = eudi and name in ('EUDI Wallet & digital identity', 'EUDI Wallet');
  if n <> 1 then
    raise exception 'EUDI scope not found (count %)', n;
  end if;

  update scopes set
    name = 'EUDI Wallet',
    catalog = true,
    active = true,
    is_default = false,
    instructions = $eudi$Tenders, pilots and grants for the European Digital Identity Wallet: building, certifying and connecting the wallet itself.

Go for: EUDI Wallet and national wallet development, PID and (Q)EAA issued into the wallet, wallet certification, relying-party integration with the EU wallet, and EU large-scale pilots for the wallet.

Out of scope: biometrics, KYC, onboarding and fraud prevention with no wallet, generic digital identity, payment wallets, and ID-card production.$eudi$,
    search_config = jsonb_build_object(
      'topic', 'EUDI Wallet',
      'ted_phrases', jsonb_build_array(
        'EUDI Wallet', 'European Digital Identity Wallet', 'EUDIW', 'digital identity wallet',
        'Europäische Brieftasche für die Digitale Identität', 'portefeuille européen d''identité numérique',
        'portafoglio europeo di identità digitale', 'cartera europea de identidad digital',
        'carteira europeia de identidade digital', 'Europese digitale identiteitsportemonnee',
        'europejski portfel tożsamości cyfrowej'),
      'news_queries', jsonb_build_array(
        'EUDI Wallet rollout', 'European Digital Identity Wallet certification',
        'national EUDI wallet procurement', 'EUDI Wallet relying party'),
      'web_queries', jsonb_build_array(
        'EUDI Wallet tender', 'European Digital Identity Wallet development',
        'EUDI wallet certification procurement', 'national digital identity wallet EUDI')
    ),
    updated_at = now()
  where id = eudi;

  insert into scopes (name, instructions, active, is_default, catalog, workspace_id, owner_id, search_config, search_status)
  select v.name, v.instructions, true, false, true, platform, null::uuid, v.search_config, 'applied'
  from (values
    ('Artificial Intelligence',
     $ai$Tenders and grants for building or deploying artificial intelligence: models, AI platforms, machine learning systems, and AI features inside public-sector software.

Go for: development, integration and operation of AI systems, large language models and machine learning, and AI pilots a software company could bid for.

Out of scope: a passing mention of AI in an unrelated contract, AI policy with no system to build, and hardware with no software.$ai$,
     jsonb_build_object(
       'topic', 'Artificial Intelligence',
       'ted_phrases', jsonb_build_array('artificial intelligence', 'machine learning', 'large language model', 'AI system'),
       'news_queries', jsonb_build_array('government artificial intelligence contract Europe', 'EU AI public tender', 'machine learning procurement'),
       'web_queries', jsonb_build_array('artificial intelligence software tender Europe', 'machine learning system public sector', 'large language model government contract'))),
    ('Cybersecurity',
     $cy$Tenders and grants for cybersecurity work a software company can deliver: security operations, application security, penetration testing, and secure systems for the public sector.

Go for: security operations centres and monitoring, application and cloud security, incident response, NIS2-related system work, and security software.

Out of scope: locks, cameras and physical security with no cyber system, staffing-only contracts, and insurance.$cy$,
     jsonb_build_object(
       'topic', 'Cybersecurity',
       'ted_phrases', jsonb_build_array('cybersecurity', 'cyber security', 'security operations centre', 'penetration testing'),
       'news_queries', jsonb_build_array('cybersecurity contract awarded Europe', 'NIS2 cybersecurity procurement', 'government security operations centre'),
       'web_queries', jsonb_build_array('cybersecurity software tender Europe', 'penetration testing public sector contract', 'security operations centre procurement'))),
    ('Digital ID & Biometrics',
     $id$Tenders and grants for digital identity besides the EUDI Wallet: biometrics, digital onboarding, KYC, identity verification and fraud prevention.

Go for: biometric identification (face, fingerprint, voice), citizen and customer onboarding, KYC and identity proofing, and fraud and deepfake detection.

Out of scope: the EUDI Wallet and national EUDI wallet rollouts, payment cards, and physical ID-card production.$id$,
     jsonb_build_object(
       'topic', 'Digital ID & Biometrics',
       'ted_phrases', jsonb_build_array('biometric identification', 'biometrics', 'know your customer', 'digital onboarding', 'identity verification', 'fraud detection', 'facial recognition', 'fingerprint identification'),
       'news_queries', jsonb_build_array('biometric identity tender Europe', 'KYC onboarding public sector', 'digital identity fraud prevention'),
       'web_queries', jsonb_build_array('biometrics identity verification procurement', 'KYC digital onboarding government', 'fraud detection identity software'))),
    ('Healthcare software',
     $hs$Software tenders for hospitals and health services: clinical systems, patient records and the software around them.

Go for: hospital information systems, electronic health records, patient administration, laboratory and imaging software, and health-data platforms a software company would build or implement.

Out of scope: medicines, medical devices with no software, hospital construction, and staffing.$hs$,
     jsonb_build_object(
       'topic', 'Healthcare software',
       'ted_phrases', jsonb_build_array('hospital information system', 'electronic health record', 'patient administration system', 'laboratory information system'),
       'news_queries', jsonb_build_array('hospital information system tender Europe', 'electronic health record procurement', 'health software contract awarded'),
       'web_queries', jsonb_build_array('hospital information system procurement Europe', 'electronic patient record software tender', 'laboratory information system contract'))),
    ('ERP & business software',
     $erp$Large software tenders for the systems public bodies run on: ERP, finance, HR and case-management platforms.

Go for: enterprise resource planning, finance and HR systems, case management and registries, and the implementation work around them.

Out of scope: hardware-only supply, body-shopping with no system, and construction.$erp$,
     jsonb_build_object(
       'topic', 'ERP & business software',
       'ted_phrases', jsonb_build_array('enterprise resource planning', 'ERP system', 'SAP S/4HANA', 'case management system'),
       'news_queries', jsonb_build_array('ERP contract public sector Europe', 'government finance system tender', 'SAP implementation public sector'),
       'web_queries', jsonb_build_array('enterprise resource planning tender Europe', 'ERP implementation government', 'finance system software procurement'))),
    ('Cloud platforms',
     $cl$Software tenders for cloud platforms and the move onto them: government cloud, platforms and cloud-native systems.

Go for: cloud platforms, sovereign and government cloud, cloud migration of information systems, and platform engineering a software company would deliver.

Out of scope: telecom circuits, device supply, and a passing mention of cloud in an unrelated contract.$cl$,
     jsonb_build_object(
       'topic', 'Cloud platforms',
       'ted_phrases', jsonb_build_array('cloud platform', 'government cloud', 'sovereign cloud', 'cloud migration'),
       'news_queries', jsonb_build_array('government cloud contract Europe', 'sovereign cloud procurement', 'cloud platform public sector'),
       'web_queries', jsonb_build_array('government cloud platform tender', 'sovereign cloud procurement Europe', 'cloud migration information system')))
  ) as v(name, instructions, search_config)
  where not exists (select 1 from scopes s where s.name = v.name and s.catalog);

  -- The account that already had EUDI keeps it on. Other accounts start with only General.
  insert into workspace_scope_picks (workspace_id, scope_id)
  values (fc, eudi)
  on conflict do nothing;

  select count(*) into n from scopes where is_default;
  if n <> 1 then
    raise exception 'expected one default scope, got %', n;
  end if;

  select count(*) into n from scopes where catalog and name in (
    'Artificial Intelligence', 'Cybersecurity', 'Digital ID & Biometrics', 'EUDI Wallet',
    'Healthcare software', 'ERP & business software', 'Cloud platforms');
  if n <> 7 then
    raise exception 'expected 7 catalog scopes, got %', n;
  end if;

  select count(*) into n from scope_sources where scope_id = eudi;
  if n <> 34 then
    raise exception 'EUDI follows changed (%)', n;
  end if;

  select count(*) into n from workspace_scope_picks where workspace_id = fc and scope_id = eudi;
  if n <> 1 then
    raise exception 'EUDI was not kept on for its workspace';
  end if;

  select count(*) into n from scopes where id = eudi and name = 'EUDI Wallet' and catalog and not is_default
    and search_config->>'topic' = 'EUDI Wallet';
  if n <> 1 then
    raise exception 'EUDI Wallet was not updated';
  end if;
end $$;

notify pgrst, 'reload schema';
