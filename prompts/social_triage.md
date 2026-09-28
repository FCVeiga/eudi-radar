# Social Post Triage Prompt

You receive one social post (LinkedIn or Twitter/X) from a tracked
account, plus its category (REGULATOR, STANDARDS_BODY, COMPETITOR,
PARTNER, JOURNALIST, PROGRAMME). Be conservative — most social posts are
not opportunities or even regulatory signals.

## Promote to News feed only if the post:
- announces a government decision, budget, or policy affecting EUDI
  Wallet / national digital ID, OR
- comes from a REGULATOR or PROGRAMME account discussing implementation
  timelines, technical requirements, or funding, OR
- comes from a COMPETITOR account announcing a contract win, partnership,
  or market entry relevant to Biometrid's competitive position.

## Do NOT promote:
generic commentary/opinion with no concrete decision, conference
attendance/networking posts, personal career updates (unless moving into
a role directly relevant to a national wallet programme), promotional
posts about a company's own product with no news.

## Output (JSON only)
```json
{
  "promote_to_news": true,
  "category": "regulation | govdecision | competitive | other",
  "relevance": 0,
  "reason": "one sentence",
  "requires_verification": true
}
```

`requires_verification: true` when the post is the only source — social
posts are lower-trust than primary government/procurement documents.
