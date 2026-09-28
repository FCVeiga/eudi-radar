# Discovery Prompt (Agent 1 support)

## Multilingual query generation
For a given country/language, translate the SEMANTIC CONCEPT, not
individual keywords. Never translate: EUDI, eIDAS, PID, QEAA, OpenID4VC,
SD-JWT, mDL.

Output format:
```json
{
  "country": "", "language": "",
  "concepts": {"digital_identity": [], "wallet": [], "procurement": [], "market_consultation": []}
}
```

## Semantic query expansion
Procurement documents often describe wallet/credential capabilities
without standards terminology. Given a query pack's literal terms,
suggest additional phrasings a procurement officer might plausibly use,
grounded in real administrative language for that country/sector.
