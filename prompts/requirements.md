# Requirements Extraction Prompt

## Pass 1 — Extraction
Extract EVERY individual requirement as a separate structured record.
Never summarise multiple requirements into one generic statement.

Categories: LEGAL, FINANCIAL, TURNOVER, INSURANCE, CERTIFICATION,
COMPANY_EXPERIENCE, REFERENCE, TEAM, CV, EDUCATION, PERSONAL_CERTIFICATION,
SECURITY_CLEARANCE, LANGUAGE, FTE, LOCAL_PRESENCE, TECHNICAL, SECURITY,
PRIVACY, EIDAS, EUDI, INTEROPERABILITY, HOSTING, SLA, IMPLEMENTATION,
CONSORTIUM, SUBCONTRACTING, EVIDENCE, AWARD.

For TEAM: extract each role as its own record (role, number required,
education, certifications, experience years, project types, technologies,
languages, security clearance, allocation %, onsite requirement).

For REFERENCE: number of references, minimum contract value + currency,
minimum duration, reference period, sector, technology, geography,
minimum users/countries, large-scale/public-sector/cross-border flags,
evidence required.

For FINANCIAL: turnover, specific turnover, solvency, liquidity, insurance,
audited-accounts requirements, number of financial years, consortium
aggregation rules, lead-member requirements, EXACT evidence demanded.

AWARD CRITERIA go in a separate list — never merge with eligibility.

## Pass 2 — Validation (always run)
Re-inspect all documentation for missed mandatory requirements, checking
trigger terms (in the document's own language): shall, must, minimum,
at least, required, mandatory, economic capacity, technical capacity,
professional capacity, experience, certificate, CV, expert, reference,
turnover, insurance, exclusion, eligibility.

## Confidence labelling (mandatory on every requirement)
- CONFIRMED — only if you can cite document + section/page.
- INFERRED — reasonable reading, not an explicit quoted requirement.
- UNCLEAR — ambiguous; generate a clarification_question.
- NOT_DISCLOSED — document doesn't address this at all.

Never mark CONFIRMED without an evidence pointer.
