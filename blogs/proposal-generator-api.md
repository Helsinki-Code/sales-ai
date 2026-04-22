# Generate a Full Sales Proposal From a Single JSON Payload

<!-- ============================================================
SEO METADATA
Title tag (57 chars): Sales Proposal Generator API: One Payload, Five Sections
Meta description (157 chars): Name the company, describe the problem, outline the solution — get an executive summary, problem statement, investment section, and next steps back in 3 seconds. Full code inside.
Primary keyword: sales proposal generator API
Secondary keywords: generate sales proposal API, automate sales proposals, proposal generation API, AI proposal generator API, HubSpot proposal automation
URL slug: /blog/sales-proposal-generator-api
Schema type: TechArticle + FAQPage + HowTo
============================================================ -->

**Published:** April 2026 | **Reading time:** 8 min | **Audience:** Backend developers, RevOps engineers, technical founders

---

<!-- ============================================================
FEATURED IMAGE
Image gen prompt: Dark-mode split-screen illustration. LEFT PANEL (35%): a minimal POST request terminal. Headers show Authorization Bearer. JSON body shows four compact fields: "company", "problem", "solution", "pricing" with green values. BOTTOM LEFT: small badge "3.1s". RIGHT PANEL (65%): a glowing multi-section proposal document card floating on dark background. Five coloured section tabs visible: "Executive Summary" (purple), "Problem Statement" (red), "Proposed Solution" (blue), "Investment" (green), "Next Steps" (orange). Each section shows 2 lines of white text fading to grey. Background: deep charcoal. Electric blue connection arrow between panels. No people. 4K, 16:9.
Alt tag: Sales proposal generator API showing POST request with company problem solution pricing fields returning five-section proposal document in 3 seconds
============================================================ -->

---

> **The situation this solves:** Your rep moves a deal to "Proposal" stage in HubSpot. Someone on the team now has to open a blank document, copy the company name, the problem statement from meeting notes, the pricing from a spreadsheet, and the next steps from memory — then spend two hours writing something that looks mostly like the last proposal. This is a solved problem. One API call returns the full document in 3 seconds.

---

## Table of Contents

1. [The Gap in Existing Proposal Tools](#the-gap)
2. [The API Call — Request to Full Proposal in 3 Seconds](#the-api-call)
3. [What Input Drives Output Quality](#what-input-drives-quality)
4. [Piping CRM Data Directly Into the Payload](#piping-crm-data)
5. [HubSpot Deal Stage Webhook → Auto-Generate Proposal](#hubspot-webhook)
6. [Pipedrive Integration](#pipedrive-integration)
7. [Storing and Sending Generated Proposals](#storing-and-sending)
8. [FAQ: Sales Proposal Generator API](#faq)

---

## The Gap in Existing Proposal Tools

The top-ranking tools for "sales proposal software" — PandaDoc, Qwilr, Proposify, Better Proposals — all follow the same model: a document editor where you build templates, drag in CRM fields, and produce a branded PDF. They are excellent UI-first tools for sales teams that want to manage proposals inside a dashboard.

They are not APIs.

If you want proposal generation to happen automatically — triggered by a webhook, integrated into your CRM workflow, stored as structured data in your database — these tools require you to navigate their integration marketplace, configure their webhooks, and work within their proprietary template systems.

The `/sales/proposal` endpoint is the API layer that doesn't exist in that ecosystem: `POST` a JSON payload with deal context, get a structured five-section proposal back in 3 seconds. Drop it into any storage or sending layer you already own.

---

## The API Call — Request to Full Proposal in 3 Seconds

**Request:**
```bash
curl -X POST https://api.sales-ai.app/api/v1/sales/proposal \
  -H "Authorization: Bearer $WORKSPACE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "company": "DataFlow Inc",
    "problem": "DataFlow'\''s SDR team (3 reps) manually qualifies 200 inbound leads per month. 60% of Tier A leads go uncontacted within 24 hours due to research and scoring bottlenecks. Response time averages 4 hours; industry best practice is under 5 minutes.",
    "solution": "Sales AI BYOK API — 15 endpoints for research, qualification, outreach, and follow-up automation. Leads are researched, scored, and outreach-ready within 90 seconds of CRM entry. No per-seat AI fees; token costs go to your Anthropic account.",
    "pricing": "Growth plan: $X/month platform. Estimated LLM cost at current volume: ~$40/month. Compared to current manual process cost: 3 reps × 2hrs/day research = $2,400/month in labour."
  }'
```

**Response (3.1 seconds):**
```json
{
  "status": "success",
  "data": {
    "executive_summary": "DataFlow Inc faces a critical bottleneck in lead response time: 60% of high-intent prospects go uncontacted within the 24-hour window that determines conversion likelihood. This proposal outlines how Sales AI's BYOK API eliminates that bottleneck by automating research, scoring, and outreach generation — reducing time-to-first-contact from 4 hours to under 90 seconds, and freeing your SDR team to focus on relationships rather than research.",
    "problem_statement": "Your current inbound process depends on three SDRs manually researching and qualifying 200 leads per month. Each qualification cycle takes 20–40 minutes per lead. At current volume, the team cannot prioritise effectively: high-intent Tier A prospects sit in the same queue as leads that would be auto-disqualified in seconds with AI scoring. The 4-hour average response time is 48× industry best practice, and the data shows this gap directly correlates with the 60% contact rate on high-value leads.",
    "proposed_solution": "Sales AI's BYOK API integrates directly with your HubSpot CRM. When a new contact is created, the API automatically: (1) researches the company for news, tech stack, and buying signals; (2) scores the lead against your ICP with a 0–100 score and Tier A/B/C/D classification; (3) generates personalised outreach copy for the assigned rep. The rep reviews and sends — not researches and writes. Tier A leads are flagged immediately via Slack. Total time from CRM entry to rep notification: under 90 seconds.",
    "investment": "Platform subscription: $X/month. LLM token costs (billed directly to your Anthropic account): approximately $40/month at current lead volume. Compared to current process cost of approximately $2,400/month in SDR research time, the platform pays for itself with a 2% improvement in Tier A contact rate. No per-seat fees as your team scales.",
    "next_steps": "1. 15-minute technical call to review your HubSpot field mapping. 2. Workspace setup and Anthropic key connection (30 minutes, guided). 3. Pilot: 2-week run on your next 50 inbound leads with before/after contact rate comparison. 4. Full rollout decision based on pilot data."
  },
  "meta": {
    "model": "claude-sonnet-4-20250514",
    "tokens_used": 1247,
    "duration_ms": 3120
  }
}
```

Every field is structured JSON — parseable, storable, and appendable to any document template without regex or string parsing.

<!-- ============================================================
IMAGE 1 — Five-section proposal output annotated
Image gen prompt: Dark-mode five-card vertical stack. Each card represents one proposal section with a coloured left border. Card 1 (purple, "executive_summary"): 2-line preview, annotation arrow "Opens with the business impact, not the product". Card 2 (red, "problem_statement"): annotation "Uses prospect's own numbers — 60%, 4hrs, 200 leads". Card 3 (blue, "proposed_solution"): annotation "Three-numbered steps — decision-maker readable". Card 4 (green, "investment"): annotation "ROI framing — compares to existing cost". Card 5 (orange, "next_steps"): annotation "Four numbered steps, no vague 'we'll be in touch'". Charcoal background. No people. 16:9.
Alt tag: Sales proposal generator API five-section output showing executive summary problem statement proposed solution investment and next steps with quality annotations
============================================================ -->

---

## What Input Drives Output Quality

The proposal quality scales directly with the specificity of what you put in. Here's the contrast:

**Sparse input:**
```json
{
  "company": "Acme Corp",
  "problem": "They need help with sales",
  "solution": "Our product",
  "pricing": "$500/month"
}
```
Output: generic executive summary, vague problem statement, product pitch masquerading as a solution section. Usable as a starting draft but not compelling.

**Rich input (what you actually have in your CRM after a discovery call):**
```json
{
  "company": "DataFlow Inc — 180-person B2B SaaS, Series B, RevOps team of 2",
  "problem": "3 SDRs qualify 200 inbound leads/month manually. 60% of Tier A leads uncontacted in 24hrs. Avg response time 4hrs vs 5min best practice. SDR research takes 20-40min per lead.",
  "solution": "Sales AI BYOK API: automated research + qualification + outreach on CRM contact creation. Tier A leads to rep in 90s. No per-seat fees.",
  "pricing": "Growth plan $X/mo platform + ~$40/mo Anthropic tokens. vs $2,400/mo current SDR research labor cost. ROI breakeven at 2% improvement in Tier A contact rate."
}
```
Output: the five-section proposal shown above — specific numbers, the prospect's problem language reflected back, ROI framing built from their own cost data.

**The rule:** Feed the API the same information you'd give a proposal writer. The more specific the problem statement (with their numbers, their language, their process described), the more persuasive the output.

---

## Piping CRM Data Directly Into the Payload

Every deal in your CRM already has the fields you need — if your team fills them in during discovery. Map CRM properties directly to the proposal payload:

```python
import requests

def generate_proposal_from_deal(deal_properties: dict, workspace_key: str) -> dict:
    """
    Generate a sales proposal from CRM deal properties.
    Maps standard HubSpot/Pipedrive deal fields to proposal payload.
    """
    payload = {
        "company": deal_properties.get("company_name", ""),
        
        "problem": " ".join(filter(None, [
            deal_properties.get("pain_point_summary", ""),
            deal_properties.get("current_process_description", ""),
            deal_properties.get("quantified_impact", ""),  # "3 SDRs, 200 leads/month..."
        ])),
        
        "solution": " ".join(filter(None, [
            deal_properties.get("proposed_solution", "Sales AI BYOK API"),
            deal_properties.get("relevant_endpoints", ""),
            deal_properties.get("key_differentiators", ""),
        ])),
        
        "pricing": " ".join(filter(None, [
            f"Platform: {deal_properties.get('deal_amount', '')}",
            deal_properties.get("pricing_notes", ""),
            deal_properties.get("roi_calculation", ""),
        ])),
    }
    
    response = requests.post(
        "https://api.sales-ai.app/api/v1/sales/proposal",
        headers={"Authorization": f"Bearer {workspace_key}"},
        json=payload,
        timeout=30
    )
    response.raise_for_status()
    return response.json()["data"]
```

The quality improvement from adding three or four custom deal properties (`pain_point_summary`, `quantified_impact`, `roi_calculation`) to your CRM template and having reps fill them in during discovery calls is significant. The proposal then writes itself.

---

## HubSpot Deal Stage Webhook → Auto-Generate Proposal

The most common production pattern: trigger proposal generation automatically when a deal moves to the "Proposal" stage.

**Step 1: Configure HubSpot pipeline automation**

In HubSpot → Settings → Objects → Deals → Pipelines → Automate:
- Stage: "Proposal"
- Action: Send webhook to `https://your-server.com/webhooks/hubspot-deal`

**Step 2: Webhook handler**

```python
from fastapi import FastAPI, Request
import requests
import httpx

app = FastAPI()
WORKSPACE_KEY = "your_workspace_key"
HUBSPOT_TOKEN = "your_hubspot_token"

@app.post("/webhooks/hubspot-deal")
async def hubspot_deal_webhook(request: Request):
    payload = await request.json()
    
    for event in payload:
        if (event.get("propertyName") == "dealstage" and
            event.get("propertyValue") == "proposal"):  # your stage ID
            
            deal_id = event["objectId"]
            await generate_and_store_proposal(deal_id)
    
    return {"ok": True}

async def generate_and_store_proposal(deal_id: int):
    """Fetch deal from HubSpot, generate proposal, write back as note."""
    
    # Fetch deal properties from HubSpot
    async with httpx.AsyncClient() as client:
        deal_resp = await client.get(
            f"https://api.hubapi.com/crm/v3/objects/deals/{deal_id}",
            params={"properties": "dealname,company,pain_point_summary,quantified_impact,proposed_solution,amount,roi_calculation"},
            headers={"Authorization": f"Bearer {HUBSPOT_TOKEN}"}
        )
        deal = deal_resp.json()["properties"]
    
    # Generate proposal
    proposal = generate_proposal_from_deal(deal, WORKSPACE_KEY)
    
    # Format as HubSpot note
    note_body = f"""
## AI-Generated Proposal Draft — {deal.get('dealname')}

### Executive Summary
{proposal['executive_summary']}

### Problem Statement
{proposal['problem_statement']}

### Proposed Solution
{proposal['proposed_solution']}

### Investment
{proposal['investment']}

### Next Steps
{proposal['next_steps']}

---
_Generated by Sales AI API — review and personalise before sending_
    """.strip()
    
    # Post note to HubSpot deal timeline
    async with httpx.AsyncClient() as client:
        await client.post(
            "https://api.hubapi.com/crm/v3/objects/notes",
            headers={"Authorization": f"Bearer {HUBSPOT_TOKEN}"},
            json={
                "properties": {
                    "hs_note_body": note_body,
                    "hs_timestamp": str(int(time.time() * 1000)),
                },
                "associations": [{
                    "to": {"id": deal_id},
                    "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 214}]
                }]
            }
        )
    
    print(f"Proposal generated and attached to deal {deal_id}")
```

The rep opens the deal, sees the proposal draft as a note in the timeline, copies the content to their document template, personalises it (names, specific numbers), and sends. Research and first-draft time: zero. [HubSpot's pipeline automation documentation](https://knowledge.hubspot.com/object-settings/set-up-pipeline-automations-for-objects) covers the webhook trigger setup.

---

## Pipedrive Integration

The same pattern works for Pipedrive using their webhook system:

```python
@app.post("/webhooks/pipedrive-deal")
async def pipedrive_deal_webhook(request: Request):
    event = await request.json()
    
    # Trigger on deal stage change to "Proposal Sent" or equivalent
    if (event.get("event") == "updated.deal" and
        event["current"].get("stage_id") == YOUR_PROPOSAL_STAGE_ID):
        
        deal = event["current"]
        
        proposal = generate_proposal_from_deal({
            "company_name": deal.get("org_name", ""),
            "pain_point_summary": deal.get("pain_points_cf", ""),  # custom field
            "quantified_impact": deal.get("impact_cf", ""),
            "proposed_solution": "Sales AI BYOK API",
            "deal_amount": str(deal.get("value", "")),
        }, WORKSPACE_KEY)
        
        # Add as a note to the Pipedrive deal
        requests.post(
            "https://api.pipedrive.com/v1/notes",
            params={"api_token": PIPEDRIVE_TOKEN},
            json={
                "content": format_proposal_as_html(proposal),
                "deal_id": deal["id"],
                "pinned_to_deal_flag": 1
            }
        )
    
    return {"ok": True}
```

---

## Storing and Sending Generated Proposals

After generation, you have a structured Python/TypeScript object with five string fields. Common downstream steps:

**Store in database for version history:**
```python
db.execute("""
    INSERT INTO proposals (deal_id, executive_summary, problem_statement, 
                           proposed_solution, investment, next_steps, generated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
""", deal_id, proposal["executive_summary"], proposal["problem_statement"],
    proposal["proposed_solution"], proposal["investment"], proposal["next_steps"])
```

**Convert to Google Docs via API:**
Use the structured fields to populate a Google Docs template with the Docs API — each section maps to a named placeholder in the template.

**Convert to PDF:**
Run the sections through an HTML template and convert with WeasyPrint (Python) or Puppeteer (Node) to produce a branded PDF for email attachment.

**Post to Slack for rep review:**
```python
slack_client.chat_postMessage(
    channel=rep_slack_id,
    text=f"*Proposal draft ready for {company_name}*",
    blocks=[
        {"type": "section", "text": {"type": "mrkdwn",
         "text": f"*Executive Summary*\n{proposal['executive_summary'][:200]}..."}},
        {"type": "actions", "elements": [
            {"type": "button", "text": {"type": "plain_text", "text": "View in HubSpot"},
             "url": f"https://app.hubspot.com/contacts/{portal_id}/deal/{deal_id}"}
        ]}
    ]
)
```

[Start the quickstart →](/docs/quickstart) · [Full API reference for /sales/proposal →](/docs/api-reference)

---

## FAQ: Sales Proposal Generator API

### How do I automate sales proposal generation?

Set up a CRM webhook that fires when a deal moves to the "Proposal" stage. Your server handler fetches the deal properties (company, problem description, proposed solution, pricing), constructs a JSON payload, and POSTs it to `POST /api/v1/sales/proposal`. The response contains five structured sections (executive summary, problem statement, proposed solution, investment, next steps) that you write back to the CRM as a note or store in your database. Total automation time from deal stage change to proposal draft: under 30 seconds.

### What makes a good sales proposal?

Specificity. The strongest proposals use the prospect's own language and numbers to describe their problem — not generic pain point categories. The best `problem` field input comes directly from discovery call notes: the exact number of leads, the exact time lost, the exact cost. The more specific your input to the API, the more persuasive the generated proposal.

### Can AI write proposals for me?

Yes, with the right context. The `/sales/proposal` endpoint generates a complete five-section proposal from four input fields. Quality scales with input richness — sparse inputs produce generic drafts, detailed inputs produce compelling proposals that reflect the prospect's specific situation. The generated output is a review-and-send starting point, not a zero-edit publish.

### How do I generate proposals from CRM data?

Map your CRM deal properties to the proposal payload: `dealname/company_name → company`, custom fields for pain points → `problem`, product/solution fields → `solution`, deal value + ROI notes → `pricing`. Configure a pipeline stage automation webhook. The handler fetches deal properties and calls the proposal API. The most impactful improvement: add three or four custom discovery fields to your deal template (pain point summary, quantified impact, ROI calculation) and have reps fill them in during discovery calls.

### Is there an API for proposal generation?

Yes. `POST /api/v1/sales/proposal` at Sales AI returns a structured five-section proposal in JSON from a four-field payload. BYOK — token costs go to your Anthropic account. No per-seat fees, no template system to configure, no dashboard to navigate. [See the API reference →](/docs/api-reference)

---

## Related Resources

- [Sales AI API Reference — /sales/proposal full schema →](/docs/api-reference)
- [Complete AI Sales Pipeline Tutorial →](/blog/add-ai-to-sales-workflow)
- [Sales AI Quickstart →](/docs/quickstart)
- [HubSpot Pipeline Automation Documentation](https://knowledge.hubspot.com/object-settings/set-up-pipeline-automations-for-objects)
- [HubSpot CRM API — Notes endpoint](https://developers.hubspot.com/docs/api/crm/notes)
- [Anthropic API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)

---
<!-- SCHEMA: TechArticle + FAQPage + HowTo (4-step CRM automation) -->
