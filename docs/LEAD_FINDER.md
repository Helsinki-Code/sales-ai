# Lead Finder V3 Quickstart

Lead Finder turns an ICP into scored, evidence-backed prospects.

## UI flow
1. Open `/lead-finder`.
2. Enter seller website, description, and value proposition.
3. Add industries, locations, keywords, and buyer personas.
4. Choose count, minimum score, and email-confidence requirements.
5. Run the job, watch the timeline, inspect evidence, then export CSV.

## API request
Legacy `{ "url": "https://example.com", "count": 10 }` still works. New clients should send:

```json
{
  "seller": { "website": "https://sales-ai.app", "description": "AI sales automation API for developer teams" },
  "target": { "industries": ["B2B SaaS"], "personas": ["VP Sales"], "keywords": ["HubSpot"] },
  "constraints": { "count": 25, "minScore": 70, "emailConfidence": "verified_or_pattern" },
  "output": { "format": "leads_v3" }
}
```

Poll the returned job until `status=complete`; result rows contain `company`, `contact`, `score`, `signals`, and `evidence`.

## Scoring
Scores combine ICP fit (40), persona fit (20), growth signal (15), tech/intent signal (15), and evidence quality (10). Grades: A 80+, B 65-79, C 50-64, D <50.
