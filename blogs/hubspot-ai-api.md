# How to Wire Sales AI Endpoints Into HubSpot Workflows (Without a Zapier Middle Layer)

<!-- ============================================================
SEO METADATA
Title tag (60 chars): Add AI to HubSpot API Direct: No Zapier Integration Guide
Meta description (157 chars): Trigger /sales/qualify when a deal is created. Fire /sales/outreach when a contact is added. Direct HubSpot webhook → Sales AI → write results back. No automation platform needed.
Primary keyword: add AI to HubSpot API direct
Secondary keywords: HubSpot AI integration API, HubSpot webhook sales AI, add AI to HubSpot CRM, HubSpot qualify leads API
URL slug: /blog/add-ai-to-hubspot-api
Schema type: TechArticle + FAQPage + HowTo
============================================================ -->

**Published:** April 2026 | **Reading time:** 10 min | **Audience:** Backend developers, HubSpot API integrators, RevOps engineers

---

<!-- ============================================================
FEATURED IMAGE
Image gen prompt: Dark-mode integration architecture diagram. Three nodes connected by glowing arrows forming a triangle. LEFT node: orange HubSpot logo circle labelled "HubSpot CRM". CENTRE-RIGHT node: electric blue shield circle labelled "Sales AI API". BOTTOM node: green database circle labelled "HubSpot CRM (results written back)". Arrow from HubSpot → Sales AI labelled "webhook: deal stage changed". Arrow from Sales AI → Your Server labelled "POST request → qualify lead". Arrow from Your Server → HubSpot labelled "write score + tier + outreach to contact". Above the triangle: a small red "No Zapier" badge with strikethrough. Background: deep charcoal. No people. 4K, 16:9.
Alt tag: HubSpot AI API direct integration diagram showing HubSpot webhook triggering Sales AI qualification API then writing results back to CRM without Zapier middleware
============================================================ -->

---

> **Why skip Zapier?** Zapier adds $20–$100/month, introduces a failure point outside your control, has execution limits, and makes debugging opaque. The HubSpot Webhooks API is free, works on any HubSpot account (even free tier via developer private app), and sends a direct HTTP POST to your server. Here's how to wire Sales AI into it end-to-end.

---

## Table of Contents

1. [Two Ways HubSpot Sends Webhooks](#two-ways-hubspot-sends-webhooks)
2. [Setting Up a HubSpot Private App](#setting-up-a-private-app)
3. [Subscribing to Contact and Deal Events](#subscribing-to-events)
4. [Pattern 1: Qualify New Contacts on Creation](#pattern-1-qualify-new-contacts)
5. [Pattern 2: Generate Outreach When a Deal is Created](#pattern-2-deal-outreach)
6. [Pattern 3: Fire Research + Proposal When Deal Reaches "Proposal" Stage](#pattern-3-proposal-stage)
7. [Writing AI Results Back to HubSpot](#writing-results-back)
8. [Full Server Implementation (FastAPI)](#full-server-implementation)
9. [FAQ: Add AI to HubSpot API](#faq)

---

## Two Ways HubSpot Sends Webhooks

HubSpot supports webhooks via two distinct mechanisms — knowing which to use matters:

**Option A: Workflow "Send a Webhook" action**
Available in Operations Hub Professional or Enterprise. Works inside the HubSpot workflow builder UI. Easy to configure, but requires a paid tier and is limited to workflow-triggerable events.

**Option B: Webhooks API via Private App**
Available on any HubSpot account — free tier included. Requires a developer private app, but programmatically subscribes to any CRM object event (contacts, deals, companies, tickets). No Operations Hub subscription needed.

As confirmed in the [HubSpot community](https://community.hubspot.com/t5/APIs-Integrations/Are-Webhooks-and-contact-API-on-free-tier/m-p/502050): *"if you use the Webhooks API then no additional subscription is needed."*

This tutorial uses **Option B** — the Webhooks API via Private App. It works on every HubSpot account and gives you the most control.

<!-- ============================================================
IMAGE 1 — Two webhook paths comparison
Image gen prompt: Dark-mode two-path diagram. LEFT path "Option A: Workflow Action" (amber): HubSpot workflow builder icon → "Send a webhook" node → label "Requires Ops Hub Pro ($800+/mo)". RIGHT path "Option B: Webhooks API" (green): code bracket icon → Private App → webhook subscription → label "Works on free tier. No Ops Hub needed." Green checkmark on right path. Charcoal background. No people. 16:9.
Alt tag: HubSpot AI API integration paths showing workflow webhook requiring Operations Hub Pro versus Webhooks API private app working on free tier
============================================================ -->

---

## Setting Up a HubSpot Private App

**Step 1:** In your HubSpot account, navigate to **Settings → Integrations → Private Apps → Create a Private App**.

**Step 2:** Set scopes. For the patterns in this tutorial, enable:
- `crm.objects.contacts.read` — fetch contact properties
- `crm.objects.contacts.write` — write AI results back
- `crm.objects.deals.read` — fetch deal properties
- `crm.objects.deals.write` — write AI results back to deals

**Step 3:** Generate the app token. Copy it — this is your `HUBSPOT_ACCESS_TOKEN`.

**Step 4:** Navigate to the **Webhooks** tab of your private app. Set your **Target URL** to your server endpoint (e.g. `https://your-server.com/webhooks/hubspot`). This must be HTTPS.

**Step 5:** Add subscriptions for the events you want to receive. Click the event type (Contact, Deal), then the specific event (created, propertyChange, etc.). We'll configure specific ones below.

---

## Subscribing to Contact and Deal Events

From the Webhooks tab, add these subscriptions:

**For contact qualification on creation:**
- Record type: Contact
- Event: `contact.creation`

**For deal-triggered outreach:**
- Record type: Deal
- Event: `deal.creation`

**For proposal generation on stage change:**
- Record type: Deal
- Event: `deal.propertyChange`
- Property: `dealstage`

HubSpot sends a `POST` to your target URL each time these events fire. The payload for each is a JSON array (HubSpot may batch multiple events together):

```json
[
  {
    "eventId": 1,
    "subscriptionId": 12345,
    "portalId": 67890,
    "appId": 111,
    "occurredAt": 1713591131000,
    "eventType": "contact.creation",
    "attemptNumber": 0,
    "objectId": 12345678,
    "changeSource": "CRM_UI",
    "propertyName": null,
    "propertyValue": null
  }
]
```

Note: the payload contains only the `objectId` — you need a second call to fetch the full contact or deal properties. This is a HubSpot design choice: [as documented in the Webhooks API](https://developers.hubspot.com/docs/api/webhooks), the webhook tells you *what changed* and you call the REST API to get the current data.

---

## Pattern 1: Qualify New Contacts on Creation

When a contact is created in HubSpot, fetch their properties, call `/sales/qualify`, and write the score back.

```python
import requests, os

HUBSPOT_TOKEN  = os.environ["HUBSPOT_ACCESS_TOKEN"]
WORKSPACE_KEY  = os.environ["SALES_AI_WORKSPACE_KEY"]
HS_HEADERS     = {"Authorization": f"Bearer {HUBSPOT_TOKEN}"}
SALES_AI_BASE  = "https://api.sales-ai.app/api/v1"

ICP = "B2B SaaS, 50-500 employees, RevOps or sales leadership, post-Series A"

def get_contact_properties(contact_id: str) -> dict:
    """Fetch full contact record from HubSpot."""
    response = requests.get(
        f"https://api.hubapi.com/crm/v3/objects/contacts/{contact_id}",
        params={"properties": "firstname,lastname,jobtitle,company,num_employees,industry,hs_lead_source"},
        headers=HS_HEADERS
    )
    response.raise_for_status()
    return response.json()["properties"]

def qualify_contact(contact_id: str):
    """
    Pattern 1: Qualify a new HubSpot contact using /sales/qualify.
    Writes score, tier, reasoning, and next action back to HubSpot.
    """
    props = get_contact_properties(contact_id)
    
    # Build lead description from HubSpot contact fields
    lead_parts = []
    if props.get("jobtitle"):     lead_parts.append(props["jobtitle"])
    if props.get("company"):      lead_parts.append(f"at {props['company']}")
    if props.get("num_employees"):lead_parts.append(f"{props['num_employees']} employees")
    if props.get("industry"):     lead_parts.append(props["industry"])
    lead_desc = ", ".join(filter(None, lead_parts))
    
    if not lead_desc.strip():
        return  # Not enough data to qualify — skip
    
    # Call Sales AI qualification endpoint
    result = requests.post(
        f"{SALES_AI_BASE}/sales/qualify",
        headers={"Authorization": f"Bearer {WORKSPACE_KEY}"},
        json={"lead": lead_desc, "icp": ICP}
    ).json()["data"]
    
    # Write results back to HubSpot custom properties
    update_contact(contact_id, {
        "ai_qualification_score": str(result["score"]),
        "ai_qualification_tier": result["tier"],
        "ai_qualification_reasoning": result["reasoning"][:255],  # HS text field limit
        "ai_next_action": result["recommended_next_action"][:255]
    })
    
    # Route Tier A immediately
    if result["tier"] == "A":
        notify_slack_rep_urgent(contact_id, props, result)

def update_contact(contact_id: str, properties: dict):
    """Write properties back to a HubSpot contact."""
    requests.patch(
        f"https://api.hubapi.com/crm/v3/objects/contacts/{contact_id}",
        headers={**HS_HEADERS, "Content-Type": "application/json"},
        json={"properties": properties}
    ).raise_for_status()
```

---

## Pattern 2: Generate Outreach When a Deal is Created

When a new deal is created, fetch deal + associated contact context, then generate personalised outreach.

```python
def get_deal_with_contact(deal_id: str) -> tuple[dict, dict | None]:
    """Fetch deal properties and the first associated contact."""
    deal_resp = requests.get(
        f"https://api.hubapi.com/crm/v3/objects/deals/{deal_id}",
        params={"properties": "dealname,dealstage,amount,description,closedate",
                "associations": "contacts"},
        headers=HS_HEADERS
    )
    deal = deal_resp.json()
    deal_props = deal["properties"]
    
    # Fetch associated contact if any
    contact_props = None
    associations = deal.get("associations", {}).get("contacts", {}).get("results", [])
    if associations:
        contact_id = associations[0]["id"]
        contact_props = get_contact_properties(contact_id)
    
    return deal_props, contact_props

def generate_deal_outreach(deal_id: str):
    """
    Pattern 2: Generate outreach copy when a new deal is created.
    Writes subject line and email body back to deal as a note.
    """
    deal, contact = get_deal_with_contact(deal_id)
    
    # Build prospect description from deal + contact context
    prospect_parts = []
    if contact:
        if contact.get("jobtitle"): prospect_parts.append(contact["jobtitle"])
        if contact.get("company"):  prospect_parts.append(f"at {contact['company']}")
    if deal.get("dealname"):        prospect_parts.append(f"deal: {deal['dealname']}")
    prospect_desc = ", ".join(filter(None, prospect_parts))
    
    if not prospect_desc.strip():
        return
    
    # Generate outreach
    result = requests.post(
        f"{SALES_AI_BASE}/sales/outreach",
        headers={"Authorization": f"Bearer {WORKSPACE_KEY}"},
        json={
            "prospect": prospect_desc,
            "context": "Sales AI BYOK API — 15 endpoints for sales automation",
            "channel": "email"
        }
    ).json()["data"]
    
    # Post outreach draft as a note on the deal
    create_deal_note(deal_id, 
        f"**AI Outreach Draft**\n\nSubject: {result['subject']}\n\n{result['body']}\n\n"
        f"_Follow-up hook: {result.get('follow_up_hook', '')}_"
    )

def create_deal_note(deal_id: str, note_body: str):
    """Create a note on a HubSpot deal."""
    import time
    note = requests.post(
        "https://api.hubapi.com/crm/v3/objects/notes",
        headers={**HS_HEADERS, "Content-Type": "application/json"},
        json={
            "properties": {
                "hs_note_body": note_body,
                "hs_timestamp": str(int(time.time() * 1000))
            },
            "associations": [{
                "to": {"id": deal_id},
                "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 214}]
            }]
        }
    )
    note.raise_for_status()
```

---

## Pattern 3: Fire Research + Proposal When Deal Reaches "Proposal" Stage

When a deal's `dealstage` property changes to your "Proposal" stage, generate a full proposal and attach it to the deal.

```python
# Map your HubSpot deal stage IDs — find them in Settings → Objects → Deals → Pipelines
PROPOSAL_STAGE_ID = "appointmentscheduled"  # replace with your actual stage ID

def handle_deal_stage_change(deal_id: str, new_stage: str):
    """
    Pattern 3: Generate proposal when deal reaches Proposal stage.
    """
    if new_stage != PROPOSAL_STAGE_ID:
        return  # Ignore all other stage changes
    
    deal, contact = get_deal_with_contact(deal_id)
    
    # Extract context from deal custom properties
    # (Add these custom properties to your HubSpot deal template during discovery)
    company = contact.get("company", deal.get("dealname", "Unknown Company")) if contact else deal.get("dealname", "Unknown")
    
    result = requests.post(
        f"{SALES_AI_BASE}/sales/proposal",
        headers={"Authorization": f"Bearer {WORKSPACE_KEY}"},
        json={
            "company": company,
            "problem": deal.get("description", "Sales automation bottleneck — manual research and qualification"),
            "solution": "Sales AI BYOK API — 15 endpoints for research, qualification, and outreach automation",
            "pricing": f"Deal amount: ${deal.get('amount', 'TBD')}. LLM costs direct to Anthropic account."
        }
    ).json()["data"]
    
    # Format as a comprehensive deal note
    proposal_note = f"""## AI Proposal Draft — {company}

### Executive Summary
{result['executive_summary']}

### Problem Statement
{result['problem_statement']}

### Proposed Solution
{result['proposed_solution']}

### Investment
{result['investment']}

### Next Steps
{result['next_steps']}

---
_AI-generated draft — review and personalise before sending_"""
    
    create_deal_note(deal_id, proposal_note)
```

---

## Writing AI Results Back to HubSpot

For the results to be useful to reps, write them to **custom contact or deal properties** that show up in the CRM view.

**Create custom properties in HubSpot:**
Settings → Objects → Contacts → Create property:
- `ai_qualification_score` — Number
- `ai_qualification_tier` — Single-line text (or dropdown: A, B, C, D)
- `ai_qualification_reasoning` — Multi-line text
- `ai_next_action` — Multi-line text

Once created, these appear in the contact record sidebar and can be used as filters for HubSpot lists and sequences.

**Write batch property updates:**
```python
def batch_update_contacts(updates: list[dict]):
    """
    Batch update multiple contacts at once.
    updates = [{"id": "123", "properties": {...}}, ...]
    More efficient than individual PATCH calls.
    """
    requests.post(
        "https://api.hubapi.com/crm/v3/objects/contacts/batch/update",
        headers={**HS_HEADERS, "Content-Type": "application/json"},
        json={"inputs": updates}
    ).raise_for_status()
```

---

## Full Server Implementation (FastAPI)

```python
from fastapi import FastAPI, Request, BackgroundTasks
import json, requests, os

app          = FastAPI()
HS_TOKEN     = os.environ["HUBSPOT_ACCESS_TOKEN"]
WORKSPACE_KEY = os.environ["SALES_AI_WORKSPACE_KEY"]

@app.post("/webhooks/hubspot")
async def hubspot_webhook(request: Request, background: BackgroundTasks):
    """
    Single endpoint for all HubSpot webhook events.
    Returns 200 immediately, processes in background.
    """
    events = await request.json()
    
    for event in events:
        event_type = event.get("eventType", "")
        object_id  = str(event.get("objectId", ""))
        
        if event_type == "contact.creation":
            background.add_task(qualify_contact, object_id)
        
        elif event_type == "deal.creation":
            background.add_task(generate_deal_outreach, object_id)
        
        elif event_type == "deal.propertyChange":
            new_value = event.get("propertyValue", "")
            if event.get("propertyName") == "dealstage":
                background.add_task(handle_deal_stage_change, object_id, new_value)
    
    # Return 200 fast — HubSpot retries on timeout
    return {"received": True}

@app.get("/webhooks/hubspot")
async def hubspot_verify(request: Request):
    """
    HubSpot sends a GET with challenge parameter to verify webhook URL.
    """
    challenge = request.query_params.get("challenge", "")
    return {"challengeResponse": challenge}
```

Deploy this to any HTTPS server. HubSpot sends a `GET` request with a `challenge` parameter to verify your endpoint before activating subscriptions — the `GET` handler above handles that.

[See the full quickstart →](/docs/quickstart) · [HubSpot Webhooks API reference](https://developers.hubspot.com/docs/api/webhooks)

---

## FAQ: Add AI to HubSpot API

### How do I integrate AI into HubSpot?

Use the HubSpot Webhooks API (via a private app — no Operations Hub subscription required). Subscribe to CRM events (contact.creation, deal.creation, deal.propertyChange). When HubSpot fires a webhook, your server receives the `objectId`, fetches full properties from the HubSpot CRM API, calls a Sales AI endpoint (`/sales/qualify`, `/sales/outreach`, `/sales/proposal`), and writes the structured results back using `PATCH /crm/v3/objects/contacts/{id}`.

### Can I call an external API from HubSpot workflows?

Yes — two ways. (1) The HubSpot Webhooks API (private app) sends a POST to your server when any CRM event occurs. Your server then calls any external API. (2) HubSpot Operations Hub Pro/Enterprise has a "Send a Webhook" workflow action that can POST deal context directly to an external URL. For developers who want to avoid the Ops Hub subscription cost, Option 1 via private app works on any HubSpot tier.

### How do I qualify HubSpot leads with AI?

Subscribe to `contact.creation` via a HubSpot private app webhook. When a contact is created, fetch their properties (job title, company, industry, employee count) from the HubSpot CRM API. Build a lead description string. POST to `POST /api/v1/sales/qualify` with the lead description and your ICP definition. Write the returned score, tier, reasoning, and next action back to custom contact properties using `PATCH /crm/v3/objects/contacts/{id}`.

### What is the HubSpot webhook payload?

HubSpot webhook payloads are JSON arrays. Each event contains: `eventType` (e.g. `contact.creation`), `objectId` (the CRM object's ID), `portalId`, `occurredAt` timestamp, and for property change events: `propertyName` and `propertyValue`. The payload does not include contact/deal properties — you fetch those with a separate CRM API call using the `objectId`.

### How do I write API results back to HubSpot?

Use `PATCH https://api.hubapi.com/crm/v3/objects/contacts/{id}` (or `/deals/{id}`) with your private app token. Create custom contact properties first in HubSpot Settings → Objects → Contacts → Create property. Property types: use Number for scores, Single-line text for tier, Multi-line text for reasoning and next actions. For bulk updates, use `POST /crm/v3/objects/contacts/batch/update` to update multiple contacts in one call.

---

## Related Resources

- [Sales AI API Reference →](/docs/api-reference)
- [Sales AI Quickstart →](/docs/quickstart)
- [AI Lead Qualification API Tutorial →](/blog/ai-lead-qualification-api)
- [AI Outreach Email API Tutorial →](/blog/ai-outreach-email-api)
- [Sales Proposal Generator API →](/blog/sales-proposal-generator-api)
- [HubSpot Webhooks API Documentation](https://developers.hubspot.com/docs/api/webhooks)
- [HubSpot CRM Contacts API](https://developers.hubspot.com/docs/api/crm/contacts)
- [Integrate.io: HubSpot Webhook Integration Guide](https://www.integrate.io/blog/integrate-webhooks-with-hubspot/)
