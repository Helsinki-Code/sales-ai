# Score Any Lead Against Your ICP in One API Call — No ML Training Required

<!-- ============================================================
SEO METADATA
Title tag (60 chars): ICP Scoring API: Score Leads Against Your ICP in One Call
Meta description (158 chars): Stop rebuilding your ICP scoring logic in every tool. POST a lead and your ICP definition to /sales/icp — get back a fit score, matching criteria, gaps, and recommendation in seconds.
Primary keyword: ICP scoring API automation
Secondary keywords: ICP scoring API, automate ICP scoring, AI ICP fit scoring, ideal customer profile API, lead ICP match API
URL slug: /blog/icp-scoring-api-automation
Schema type: TechArticle + FAQPage + HowTo
============================================================ -->

**Published:** April 2026 | **Reading time:** 8 min | **Audience:** RevOps engineers, technical founders, backend developers

---

<!-- ============================================================
FEATURED IMAGE
Image gen prompt: Dark-mode developer dashboard illustration. Centre: a large gauge dial showing "ICP Fit Score: 91" in bright green, with a needle pointing to the right quarter. Below the gauge: three coloured badge pills — "Series B ✓" (green), "RevOps Function ✓" (green), "50-500 employees ✓" (green). Small amber badge: "No HubSpot ✗ (optional)". Below badges: a small text card showing "Recommendation: Priority outreach — strong ICP match". In the top left: a compact code snippet showing the POST request body with a lead description and ICP definition fields. Background: deep charcoal. No people. 4K, 16:9.
Alt tag: ICP scoring API dashboard showing lead fit score 91 with matching criteria Series B RevOps function employee count and recommendation for priority outreach
============================================================ -->

---

> **The problem this solves:** Your ICP definition lives in a Notion doc. Your lead scoring lives in a 200-row Salesforce formula that someone last updated in 2023. Every new tool you add has its own scoring logic that doesn't match either. One API call — your ICP in plain English, the lead in a single string — and you get back a typed score, the matching criteria, the gaps, and a recommended next action.

---

## Table of Contents

1. [Why Rule-Based ICP Scoring Breaks Down](#why-rule-based-breaks)
2. [The API Call — Full Request and Response](#the-api-call)
3. [Writing an ICP Definition That Produces Reliable Scores](#writing-a-good-icp)
4. [Using ICP Scores in a Lead Enrichment Workflow](#in-an-enrichment-workflow)
5. [Two-Layer Qualification: /sales/icp + /sales/qualify](#two-layer-qualification)
6. [Batch Scoring With the Anthropic Batch API](#batch-scoring)
7. [FAQ: ICP Scoring API](#faq)

---

## Why Rule-Based ICP Scoring Breaks Down

The standard implementation of ICP scoring in a CRM: assign points for each attribute. Job title is VP+ = 20 points. Industry is SaaS = 15 points. Company size is 50–500 = 10 points. Total = tier.

This works at first. Then your ICP evolves — you start winning more in fintech, you stop targeting companies over 300 employees, you prioritise post-Series A over any funding stage — and the point model doesn't update because updating it requires a Salesforce admin, a sprint, and someone who remembers why all the weights were set in the first place.

The deeper problem: rule-based scoring can only score what it can measure in structured fields. It can't score:
- A VP RevOps who came from Outreach.io and is clearly evaluating stack alternatives
- A 80-person company that raised a $15M Series A six weeks ago (high budget signal)
- A founder with a RevOps background who's running sales themselves

These signals are in context — in a lead description, in research output, in LinkedIn activity — not in dropdown fields. AI ICP scoring evaluates context, not just criteria checkboxes.

As [LowCode Agency's lead qualification analysis](https://www.lowcode.agency/blog/ai-lead-qualification-and-enrichment) puts it: *"AI qualification differs from rule-based scoring: AI evaluates open-ended fields and infers intent from context; rule-based systems only score what they can measure in structured fields."*

---

## The API Call — Full Request and Response

**Request:**
```bash
curl -X POST https://api.sales-ai.app/api/v1/sales/icp \
  -H "Authorization: Bearer $WORKSPACE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "lead": "Sarah Chen, VP RevOps at DataFlow Inc — 180 employees, Series B raised Q1 2026, B2B SaaS, uses HubSpot and Outreach, previously at Outreach.io",
    "icp_definition": "B2B SaaS companies with 50-500 employees, post-Series A, with a dedicated RevOps or Sales Ops function, currently using or evaluating enterprise CRM/sales stack. Bonus signals: VP Sales or RevOps hire within 6 months, recent funding, evaluating tooling."
  }'
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "fit_score": 91,
    "matching_criteria": [
      "B2B SaaS ✓",
      "180 employees — within 50-500 range ✓",
      "Series B — post-Series A ✓",
      "VP RevOps role — dedicated RevOps function ✓",
      "Uses HubSpot and Outreach — active stack evaluation ✓",
      "Ex-Outreach.io — evaluating alternatives bonus signal ✓"
    ],
    "gaps": [
      "No explicit mention of active CRM evaluation (inferred from tech stack)"
    ],
    "recommendation": "High-priority outreach — strong ICP match with multiple bonus signals. Lead with stack evaluation angle, reference Outreach.io background to establish credibility."
  },
  "meta": {
    "model": "claude-haiku-4-5",
    "tokens_used": 287,
    "duration_ms": 820
  }
}
```

Note the model: ICP scoring runs on Claude Haiku 4.5 by default — it's a classification task that doesn't need Sonnet's reasoning depth. At $0.80/$4 per MTok, the cost per ICP scoring call is typically under $0.001. At 10,000 leads/month: under $10 in token costs.

<!-- ============================================================
IMAGE 1 — ICP scoring response annotated
Image gen prompt: Dark-mode annotated JSON response card. Four coloured annotation arrows pointing to specific fields. "fit_score: 91" (green arrow): "0-100 int — route above 80 immediately". "matching_criteria: [...]" (blue arrow): "Array of matched signals — show to rep as context". "gaps: [...]" (amber arrow): "Specific unmet criteria — useful for qualification call prep". "recommendation:" (orange arrow): "Verbatim guidance for the rep or automation logic". Monospace code font, charcoal background. No people. 16:9.
Alt tag: ICP scoring API response annotated showing fit score 91 matching criteria array gaps array and recommendation field with routing and action guidance
============================================================ -->

---

## Writing an ICP Definition That Produces Reliable Scores

The quality of ICP scoring scales directly with the quality of your ICP definition. Vague definitions produce vague scores. Specific definitions produce actionable ones.

**Vague (produces low-signal scores):**
```
"B2B SaaS companies that would benefit from sales automation"
```

**Specific (produces high-signal, reliable scores):**
```
"B2B SaaS companies with 50-500 employees.
Must have: dedicated RevOps or Sales Ops function (not just founder doing sales).
Must have: post-Series A funding (budget signal).
Preferred: currently using HubSpot or Salesforce (infrastructure sophistication).
Preferred: VP Sales or VP RevOps hired within last 12 months (growth signal).
Strong bonus: company evaluating or recently switched CRM tools.
Exclude: agencies, consultancies, services businesses.
Exclude: pre-revenue or early seed stage."
```

**What makes a good ICP definition for API scoring:**
- **Must-have criteria** — the hard filters. If any are unmet, the score should be below 40.
- **Preferred signals** — adds 10–20 points each when present.
- **Bonus signals** — strong buying intent markers that push a borderline lead to Tier A.
- **Exclusions** — explicit disqualifiers that the API should apply.
- **Plain English** — no jargon, no abbreviations the model won't recognise.

**Testing your ICP definition:** Run it against 10 known good customers and 10 known bad fits. If your best customers score below 75 or your worst fits score above 50, refine the definition. ICP definitions should be treated as living documents — update them quarterly based on what's actually closing.

---

## Using ICP Scores in a Lead Enrichment Workflow

The standard integration pattern: fire `/sales/icp` on every new CRM contact, write the score back, route by tier.

```python
import requests

WORKSPACE_KEY = "your_workspace_key"
BASE_URL      = "https://api.sales-ai.app/api/v1"

ICP_DEFINITION = """
B2B SaaS companies with 50-500 employees.
Must have: dedicated RevOps or Sales Ops function.
Must have: post-Series A funding.
Preferred: using HubSpot or Salesforce.
Preferred: VP Sales/RevOps hired in last 12 months.
Strong bonus: actively evaluating sales tooling.
Exclude: agencies, services, pre-revenue.
"""

def score_lead_against_icp(contact: dict) -> dict:
    """Score a CRM contact against your ICP. Returns structured scoring result."""
    
    # Build lead description from CRM contact fields
    lead_parts = []
    if contact.get("jobtitle"):   lead_parts.append(contact["jobtitle"])
    if contact.get("company"):    lead_parts.append(f"at {contact['company']}")
    if contact.get("num_employees"): lead_parts.append(f"{contact['num_employees']} employees")
    if contact.get("industry"):   lead_parts.append(contact["industry"])
    if contact.get("hs_lead_source"): lead_parts.append(f"source: {contact['hs_lead_source']}")
    if contact.get("custom_tech_stack"): lead_parts.append(f"stack: {contact['custom_tech_stack']}")
    lead_description = ", ".join(lead_parts)
    
    response = requests.post(
        f"{BASE_URL}/sales/icp",
        headers={"Authorization": f"Bearer {WORKSPACE_KEY}"},
        json={
            "lead": lead_description,
            "icp_definition": ICP_DEFINITION
        },
        timeout=15
    )
    response.raise_for_status()
    return response.json()["data"]

def route_by_icp_score(result: dict, contact_id: str):
    """Route lead based on ICP fit score."""
    score = result["fit_score"]
    
    if score >= 80:
        # Tier A: Assign to top rep, immediate Slack notification
        assign_to_tier_1_rep(contact_id, result["recommendation"])
        notify_slack(f"Tier A lead: {contact_id}, score {score}")
    elif score >= 60:
        # Tier B: Add to high-priority email sequence
        enrol_in_sequence(contact_id, "high_priority_nurture")
    elif score >= 40:
        # Tier C: Standard nurture
        enrol_in_sequence(contact_id, "standard_nurture")
    else:
        # Tier D: Disqualify — add to cold archive
        mark_as_disqualified(contact_id, result["gaps"])

# HubSpot webhook handler
def on_new_hubspot_contact(contact_properties: dict):
    result = score_lead_against_icp(contact_properties)
    
    # Write scoring data back to HubSpot custom properties
    update_hubspot_contact(
        contact_id=contact_properties["hs_object_id"],
        properties={
            "icp_fit_score":           str(result["fit_score"]),
            "icp_matching_criteria":   ", ".join(result["matching_criteria"]),
            "icp_gaps":                ", ".join(result["gaps"]),
            "icp_recommendation":      result["recommendation"]
        }
    )
    route_by_icp_score(result, contact_properties["hs_object_id"])
```

---

## Two-Layer Qualification: /sales/icp + /sales/qualify

For the most accurate qualification, combine ICP scoring (how well do they match our target customer?) with lead qualification (do they have active buying signals?):

```python
def deep_qualify_lead(lead_description: str, contact_id: str) -> dict:
    """
    Two-layer qualification:
    Layer 1: ICP fit — are they the right type of company?
    Layer 2: Qualification — are they in a buying cycle now?
    """
    headers = {"Authorization": f"Bearer {WORKSPACE_KEY}"}
    
    # Layer 1: ICP fit score
    icp_result = requests.post(
        f"{BASE_URL}/sales/icp",
        headers=headers,
        json={"lead": lead_description, "icp_definition": ICP_DEFINITION}
    ).json()["data"]
    
    # Only run full qualification if ICP fit is strong enough (above 60)
    if icp_result["fit_score"] < 60:
        return {
            "final_tier": "D",
            "icp_score": icp_result["fit_score"],
            "qual_score": None,
            "reason": f"Low ICP fit ({icp_result['fit_score']}). Gaps: {', '.join(icp_result['gaps'])}"
        }
    
    # Layer 2: Full qualification (checks for buying signals, decision-maker, budget)
    qual_result = requests.post(
        f"{BASE_URL}/sales/qualify",
        headers=headers,
        json={
            "lead": lead_description,
            "icp": ICP_DEFINITION  # Same definition for consistency
        }
    ).json()["data"]
    
    # Combine: ICP must be 60+, qual must be B or better for priority routing
    final_tier = qual_result["tier"]
    if icp_result["fit_score"] < 70 and qual_result["tier"] == "A":
        final_tier = "B"  # Downgrade if ICP fit is marginal despite good signals
    
    return {
        "final_tier":     final_tier,
        "icp_score":      icp_result["fit_score"],
        "qual_score":     qual_result["score"],
        "icp_criteria":   icp_result["matching_criteria"],
        "icp_gaps":       icp_result["gaps"],
        "next_action":    qual_result["recommended_next_action"]
    }
```

The two-layer approach catches edge cases that single-layer scoring misses: a high-intent lead who doesn't match your ICP (send to nurture, not immediate outreach), and a strong ICP match with no current buying signals (add to long-term nurture, not immediate outreach).

---

## Batch Scoring With the Anthropic Batch API

For processing large lead lists — nightly imports, CSV enrichment, backfill jobs — ICP scoring is an ideal candidate for the Anthropic Batch API, which provides a [50% cost discount on all models](https://platform.claude.com/docs/en/about-claude/pricing) for asynchronous processing.

```python
import anthropic

client = anthropic.Anthropic()

def batch_icp_score(leads: list[dict]) -> str:
    """
    Submit a batch ICP scoring job.
    Returns batch_id for polling.
    50% cheaper than real-time calls via Anthropic Batch API.
    """
    requests_list = []
    
    for i, lead in enumerate(leads):
        lead_desc = build_lead_description(lead)
        
        requests_list.append({
            "custom_id": f"lead_{lead['id']}_{i}",
            "params": {
                "model": "claude-haiku-4-5",
                "max_tokens": 512,
                "system": f"You are an ICP scoring expert. Score leads against this ICP:\n{ICP_DEFINITION}\n\nReturn JSON only: {{fit_score: int, matching_criteria: [str], gaps: [str], recommendation: str}}",
                "messages": [{"role": "user", "content": f"Score this lead: {lead_desc}"}]
            }
        })
    
    batch = client.beta.messages.batches.create(requests=requests_list)
    print(f"Batch submitted: {batch.id} ({len(leads)} leads)")
    return batch.id

# Usage: score 500 leads overnight for ~$0.50 total
batch_id = batch_icp_score(leads_from_csv)
```

[See the full API reference for /sales/icp →](/docs/api-reference) · [Start the quickstart →](/docs/quickstart)

---

## FAQ: ICP Scoring API

### What is ICP scoring?

ICP scoring is the process of evaluating a lead against your Ideal Customer Profile — a definition of the type of company most likely to buy and succeed with your product. A score (typically 0–100) indicates how well the lead matches your ICP across criteria like company size, industry, funding stage, role, and tech stack. Leads above a threshold (typically 70–80) are prioritised for immediate outreach; lower-scoring leads go to nurture or are disqualified.

### How do I automate ICP analysis?

POST a lead description and your ICP definition (in plain English) to `POST /api/v1/sales/icp`. The response includes a 0–100 fit score, an array of matching criteria, an array of gaps, and a recommendation string. Wire this into your CRM webhook on contact creation, write the score back to a custom field, and route by score threshold. The ICP definition is a string you update in one place — no point systems, no rule tables to maintain.

### Can AI score leads against my ICP?

Yes. `/sales/icp` uses Claude Haiku 4.5 (fast, cheap, accurate for classification tasks) to evaluate your lead description against your ICP definition in natural language. It can pick up signals that rule-based scoring misses — context about a prospect's background, inferred intent from tech stack signals, bonus buying indicators. BYOK means token costs go to your Anthropic account; at Haiku rates, batch scoring 10,000 leads costs under $10 in LLM tokens.

### What data do I need for ICP scoring?

Minimum: job title, company name, company size, industry. The score improves significantly with: funding stage, tech stack, recent signals (funding, hires), and any context from enrichment data. More context in the lead description = more accurate score. Even a minimal three-field description produces a useful score; a rich five-field description produces an actionable one with specific matching criteria and gaps.

### How do I define my ideal customer profile for API scoring?

Write it in plain English with four sections: (1) must-have criteria — hard filters that disqualify if unmet; (2) preferred signals — adds score weight when present; (3) bonus signals — strong buying intent markers; (4) explicit exclusions — disqualifiers. Test the definition against 10 known-good customers and 10 known bad fits. Refine until good customers score 75+ and bad fits score below 50. Update the definition quarterly as your ICP evolves.

---

## Related Resources

- [Sales AI API Reference — /sales/icp full schema →](/docs/api-reference)
- [AI Lead Qualification API — /sales/qualify →](/blog/ai-lead-qualification-api)
- [Complete AI Sales Workflow →](/blog/add-ai-to-sales-workflow)
- [Sales AI Quickstart →](/docs/quickstart)
- [Anthropic API Pricing — Haiku rates](https://platform.claude.com/docs/en/about-claude/pricing)
- [Clearbit ICP and Lead Scoring Model](https://clearbit.com/blog/icp-and-lead-scoring-model)
- [LowCode Agency: AI Lead Qualification and Enrichment](https://www.lowcode.agency/blog/ai-lead-qualification-and-enrichment)
