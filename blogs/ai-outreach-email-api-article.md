# Generate Personalised Outreach Emails With One API Call (Not Another SaaS Dashboard)

<!-- ============================================================
SEO METADATA
Title tag (59 chars): AI Outreach Email API: Generate Emails With One API Call
Meta description (158 chars): Skip the 47-step onboarding. POST a prospect profile to /sales/outreach and get a subject line and email body back in under 2 seconds. Wire it into HubSpot, Instantly, or your own app.
Primary keyword: AI outreach email API
Secondary keywords: personalised outreach email API, generate outreach emails API, sales outreach API, AI email generation API
URL slug: /blog/ai-outreach-email-api
Schema type: TechArticle + FAQPage + HowTo
============================================================ -->

**Published:** April 2026 | **Reading time:** 9 min | **Audience:** Backend developers, technical RevOps, agency builders

---

<!-- ============================================================
FEATURED IMAGE
Image gen prompt: Dark-mode terminal split-screen illustration. LEFT PANEL (40% width): a minimalist POST request shown in cyan monospace code. Headers show Authorization Bearer key. JSON body shows "prospect" and "context" fields in green. RIGHT PANEL (60% width): a glowing response card showing the JSON response. "subject" field glows in electric yellow: "DataFlow's Series B + a question about your sales stack". "body" field below shows first 3 lines of a personalised email in white text fading to grey. A small timer badge shows "1.8s" in green. Background: deep charcoal #0D0D0D. Connection arrow between panels pulses with blue light. No people. 4K, 16:9.
Alt tag: AI outreach email API showing POST /sales/outreach request with prospect context returning personalised subject line and email body in 1.8 seconds JSON response
============================================================ -->

---

> **The short version:** Every AI outreach tool wants you to log in, fill in a 6-step wizard, configure your brand voice, upload your product one-pager, and sit through an onboarding call. If you have a developer and an API key, you need none of that. POST a prospect description. Get a subject line and email body back. Done.

---

## Table of Contents

1. [Why API-First Outreach Beats SaaS Dashboards](#why-api-first-beats-saas)
2. [The API Call — Request, Response, and Channel Variants](#the-api-call)
3. [What Makes Outreach Email Personalised](#what-makes-outreach-personalised)
4. [Wiring Into HubSpot Workflows](#wiring-into-hubspot)
5. [Wiring Into Instantly or Lemlist Sequences](#wiring-into-instantly-lemlist)
6. [Building a Custom Outreach Microservice](#building-a-custom-microservice)
7. [Generating Multi-Step Follow-Up Sequences](#generating-follow-up-sequences)
8. [FAQ: AI Outreach Email API](#faq)

---

## Why API-First Outreach Beats SaaS Dashboards

The outreach email generation market is crowded with UI-first tools — Instantly, Reply.io, Lemlist, SmartWriter, Nureply. They all do the same thing: let non-technical users generate AI emails through a dashboard.

If you're a developer building a sales automation pipeline, a RevOps engineer wiring AI into your CRM, or an agency building outreach tooling for clients — every one of these tools adds friction you don't need:

- **Vendor-managed AI:** You don't control the model or the prompt. The output quality is whatever the tool decided.
- **No structured output:** The email returns as text in a field, not a typed `{subject: string, body: string}` you can act on programmatically.
- **Per-seat or per-credit pricing:** You pay for every user accessing the dashboard, whether they're using the AI feature or not.
- **API access requires enterprise tiers:** Apollo API access starts at [$5,000/year minimum on the custom plan](https://www.uplead.com/clay-vs-apollo/). You pay for a contact database you may not need.

An API-first approach gives you structured JSON, BYOK cost control, and zero dashboard overhead. The [Apify AI Outreach Personalizer](https://apify.com/ryanclinton/ai-outreach-personalizer) — a popular actor in the BYOK outreach space — describes the model clearly: *"$0.01/lead compute + your LLM costs. Zero AI markup."* Sales AI's `/sales/outreach` endpoint follows the same principle at the REST layer.

<!-- ============================================================
IMAGE 1 — SaaS Dashboard vs API-First Comparison
Image gen prompt: Dark-mode split comparison. LEFT "SaaS Outreach Dashboard": a blurred dashboard mockup showing multi-step wizard: "Step 1 of 6: Brand Voice". Red annotations: "Per-seat pricing", "Vendor controls the model", "Text output only". RIGHT "API-First Outreach": a clean POST request terminal window and structured JSON response card. Green annotations: "BYOK — your Anthropic key", "Typed JSON {subject, body}", "One call, no wizard". Dark charcoal background, red accents left, green accents right. No people. 16:9.
Alt tag: AI outreach email API comparison showing SaaS dashboard multi-step wizard versus API-first single POST call returning structured JSON with subject and body fields
============================================================ -->

---

## The API Call — Request, Response, and Channel Variants

The `/sales/outreach` endpoint accepts a prospect description and optional context, and returns a complete outreach message for your chosen channel.

### Basic Call — Email

```bash
curl -X POST https://api.sales-ai.app/api/v1/sales/outreach \
  -H "Authorization: Bearer $WORKSPACE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prospect": "Sarah Chen, VP RevOps at DataFlow Inc — 180 employees, Series B raised Q1 2026, previously at Outreach.io, recently posted about CRM data quality on LinkedIn",
    "context": "Sales AI: a BYOK REST API with 15 sales endpoints. No vendor AI markup. Prospect pain: CRM data quality + SDR efficiency.",
    "channel": "email"
  }'
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "subject": "DataFlow's Series B + a question about your sales stack",
    "body": "Congrats on the Series B close, Sarah — that's a milestone for the team.\n\nI noticed your recent LinkedIn post about CRM data quality. Having come from Outreach.io, you probably know better than most how much time SDRs lose when enrichment is inconsistent.\n\nWe built a BYOK sales API — 15 endpoints for research, qualification, and outreach. Your Anthropic key hits Anthropic directly, so there's no vendor markup on the AI layer.\n\nWould a 20-minute call make sense this week to see if it fits your stack?\n\nBest,",
    "follow_up_hook": "Reference the CRM data quality post if no reply in 3 days"
  },
  "meta": {
    "model": "claude-sonnet-4-20250514",
    "tokens_used": 387,
    "duration_ms": 1840,
    "request_id": "req_01abc..."
  }
}
```

**Python (under 10 lines):**
```python
import requests

def generate_outreach(prospect: str, context: str, workspace_key: str, channel: str = "email") -> dict:
    r = requests.post(
        "https://api.sales-ai.app/api/v1/sales/outreach",
        headers={"Authorization": f"Bearer {workspace_key}"},
        json={"prospect": prospect, "context": context, "channel": channel}
    )
    return r.json()["data"]

email = generate_outreach(
    prospect="Sarah Chen, VP RevOps at DataFlow Inc, Series B, ex-Outreach.io",
    context="Sales AI BYOK API — 15 endpoints, no AI markup",
    workspace_key="your_key"
)
print(email["subject"])  # → "DataFlow's Series B + a question about your sales stack"
print(email["body"])     # → Full personalised email
```

### Channel Variants: LinkedIn and SMS

The same endpoint supports three channels via the `channel` parameter:

```python
# LinkedIn DM
linkedin_dm = generate_outreach(
    prospect="Tom Wallace, Head of Sales at FinTech Inc",
    context="Sales AI BYOK API for RevOps teams",
    workspace_key=key,
    channel="linkedin"  # Returns shorter, LinkedIn-native format
)

# SMS (ultra-short, no subject line)
sms = generate_outreach(
    prospect="Maria Garcia, Founder at StartupCo",
    context="Sales AI — 15 API endpoints for sales automation",
    workspace_key=key,
    channel="sms"  # Returns <160 char body, no subject
)
```

**Channel response differences:**

| Channel | Subject | Body length | Format |
|---|---|---|---|
| `email` | Yes (6–10 words) | 80–150 words | Multi-paragraph |
| `linkedin` | No | 40–80 words | Conversational, no greeting |
| `sms` | No | <160 chars | Single message, direct CTA |

<!-- ============================================================
IMAGE 2 — Three Channel Output Cards
Image gen prompt: Dark-mode three-card layout side by side. Each card is a communication channel mockup. LEFT card (email icon, blue): shows an email with "Subject:" line and 4 lines of body text. MIDDLE card (LinkedIn icon, navy blue): shows a shorter LinkedIn DM format without subject, conversational tone, 3 lines visible. RIGHT card (SMS icon, green): shows a mobile SMS bubble with very short single-line message. All three generated from the same prospect description shown as small text at the top. Clean flat design, dark background. No people. 16:9.
Alt tag: AI outreach email API three channel variants showing email with subject line, LinkedIn DM format, and SMS format generated from same prospect description with different lengths
============================================================ -->

---

## What Makes Outreach Email Personalised

The personalisation quality of AI-generated outreach scales directly with the context you provide. Here's what drives the difference between generic and genuinely personalised:

**Generic (poor context):**
```json
{
  "prospect": "John Smith, VP Sales",
  "context": "Sales AI"
}
```
Output: *"Hi John, I wanted to reach out about Sales AI…"* — functional but forgettable.

**Personalised (rich context):**
```json
{
  "prospect": "John Smith, VP Sales at Acme Corp — 200 employees, Series A Q4 2025, recently hired 5 SDRs, tech stack includes HubSpot and Outreach, LinkedIn shows recent posts about pipeline velocity",
  "context": "Sales AI BYOK API — 15 sales endpoints. Relevant: /sales/qualify for lead scoring, /sales/research for pre-call prep. Key differentiator: no per-seat fees, bring your own Anthropic key."
}
```
Output: References the Series A, the recent SDR hires as a growth signal, and positions the API as a way to give those new SDRs better tooling — without them having to pay per seat.

**Best practices for the `prospect` field:**
- Job title + company + company size/stage
- Recent signals (funding, hires, product launches, LinkedIn activity)
- Pain point signals (tech stack, known challenges for that role/stage)
- Source of the lead (if relevant — e.g. "attended [event]")

**Best practices for the `context` field:**
- Your product's one-line description
- The specific endpoints or features most relevant to this prospect's role
- Your key differentiator vs their likely alternative

The [Sendr 2026 outreach guide](https://www.sendr.ai/blog/how-to-automatically-generate-personalized-outreach-messages-2026) summarises the market consensus: effective AI personalisation goes beyond inserting a first name — it requires deep data enrichment and connecting that enrichment to the product's value proposition. The API does the connecting; your enriched prospect data is the input.

---

## Wiring Into HubSpot Workflows

**Pattern: New CRM contact → generate outreach → store in contact record → enrol in sequence**

```python
from hubspot import HubSpot
from hubspot.crm.contacts import SimplePublicObjectInput
import requests

def on_new_hubspot_contact(contact_id: str, contact_properties: dict,
                            workspace_key: str, hubspot_token: str):
    """
    Triggered by HubSpot webhook on contact creation.
    Generates personalised outreach and writes back to contact.
    """
    # Build prospect description from HubSpot properties
    prospect = f"""
    {contact_properties.get('jobtitle', 'Unknown role')} at {contact_properties.get('company', 'Unknown company')}.
    Company size: {contact_properties.get('num_employees', 'unknown')} employees.
    Industry: {contact_properties.get('industry', 'unknown')}.
    Lead source: {contact_properties.get('hs_lead_source', 'unknown')}.
    """.strip()
    
    # Generate outreach via API
    response = requests.post(
        "https://api.sales-ai.app/api/v1/sales/outreach",
        headers={"Authorization": f"Bearer {workspace_key}"},
        json={
            "prospect": prospect,
            "context": "Sales AI: BYOK REST API with 15 sales endpoints. No AI markup, no per-seat fees.",
            "channel": "email"
        }
    )
    outreach = response.json()["data"]
    
    # Write back to HubSpot custom properties
    hs_client = HubSpot(access_token=hubspot_token)
    hs_client.crm.contacts.basic_api.update(
        contact_id=contact_id,
        simple_public_object_input=SimplePublicObjectInput(properties={
            "ai_outreach_subject": outreach["subject"],
            "ai_outreach_body": outreach["body"],
            "ai_follow_up_hook": outreach["follow_up_hook"]
        })
    )
    
    print(f"Outreach generated for {contact_properties.get('firstname', 'contact')}: {outreach['subject']}")
```

[HubSpot's webhook documentation](https://developers.hubspot.com/docs/api/webhooks) covers the trigger setup. Add a `contact.creation` subscription pointing to your server endpoint, and this handler fires for every new contact.

---

## Wiring Into Instantly or Lemlist Sequences

For teams using outreach sequencers, the pattern is:
1. Generate personalised email via `/sales/outreach`
2. Create a new lead in your sequencer with the generated subject/body as the first step
3. Enrol the lead in the sequence

**Instantly integration (Python):**
```python
import requests

def add_lead_to_instantly_campaign(
    contact_email: str, first_name: str, company: str,
    outreach_subject: str, outreach_body: str,
    instantly_api_key: str, campaign_id: str
):
    """Add an AI-personalised lead to an Instantly campaign."""
    # Instantly API: POST /api/v1/lead/add
    response = requests.post(
        "https://api.instantly.ai/api/v1/lead/add",
        json={
            "api_key": instantly_api_key,
            "campaign_id": campaign_id,
            "skip_if_in_workspace": True,
            "leads": [{
                "email": contact_email,
                "first_name": first_name,
                "company_name": company,
                # Inject personalised email as the first step
                "personalization": outreach_body,
                "custom_variables": {
                    "subject_line": outreach_subject
                }
            }]
        }
    )
    return response.json()

# Full flow
outreach = generate_outreach(
    prospect=f"{first_name} at {company}, {title}",
    context="Sales AI BYOK API",
    workspace_key=sales_ai_key
)

add_lead_to_instantly_campaign(
    contact_email=email,
    first_name=first_name,
    company=company,
    outreach_subject=outreach["subject"],
    outreach_body=outreach["body"],
    instantly_api_key=instantly_key,
    campaign_id=campaign_id
)
```

---

## Building a Custom Outreach Microservice

For teams who want a standalone microservice that generates outreach on demand, here's a production FastAPI implementation:

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
import os

app = FastAPI(title="Outreach Generation Service")
WORKSPACE_KEY = os.environ["SALES_AI_WORKSPACE_KEY"]

class OutreachRequest(BaseModel):
    prospect_name: str
    title: str
    company: str
    company_context: str
    product_context: str
    channel: str = "email"

class OutreachResponse(BaseModel):
    subject: str | None
    body: str
    follow_up_hook: str
    request_id: str
    duration_ms: int

@app.post("/generate-outreach", response_model=OutreachResponse)
async def generate_outreach(req: OutreachRequest):
    # Build rich prospect description
    prospect = f"{req.prospect_name}, {req.title} at {req.company}. {req.company_context}"
    
    response = requests.post(
        "https://api.sales-ai.app/api/v1/sales/outreach",
        headers={"Authorization": f"Bearer {WORKSPACE_KEY}"},
        json={
            "prospect": prospect.strip(),
            "context": req.product_context,
            "channel": req.channel
        },
        timeout=30
    )
    
    if not response.ok:
        raise HTTPException(status_code=502, detail=f"Sales AI API error: {response.status_code}")
    
    data = response.json()
    meta = data["meta"]
    outreach = data["data"]
    
    return OutreachResponse(
        subject=outreach.get("subject"),
        body=outreach["body"],
        follow_up_hook=outreach.get("follow_up_hook", ""),
        request_id=meta["request_id"],
        duration_ms=meta["duration_ms"]
    )
```

Deploy this as a microservice and call it from anywhere in your stack — your CRM integration, your enrichment pipeline, your outbound automation cron job.

---

## Generating Multi-Step Follow-Up Sequences

After the first touch, generate continuity follow-ups that reference the original email:

```python
def generate_full_sequence(prospect: str, context: str, workspace_key: str, steps: int = 3) -> dict:
    """Generate initial outreach + multi-step follow-up sequence."""
    headers = {"Authorization": f"Bearer {workspace_key}"}
    
    # Step 1: Generate first touch
    first_touch = requests.post(
        "https://api.sales-ai.app/api/v1/sales/outreach",
        headers=headers,
        json={"prospect": prospect, "context": context, "channel": "email"}
    ).json()["data"]
    
    # Step 2: Generate follow-up sequence based on first touch
    followups = requests.post(
        "https://api.sales-ai.app/api/v1/sales/followup",
        headers=headers,
        json={
            "prospect": prospect,
            "original_outreach": first_touch["body"],
            "steps": steps
        }
    ).json()["data"]
    
    return {
        "step_0": {"delay_days": 0, "subject": first_touch["subject"], "body": first_touch["body"]},
        "sequence": followups["sequence"]  # Steps 1, 2, 3 with delay_days
    }

# Output — complete 4-email sequence
full_sequence = generate_full_sequence(
    prospect="Sarah Chen, VP RevOps at DataFlow Inc, Series B",
    context="Sales AI BYOK API — 15 endpoints",
    workspace_key=key
)

for step in [full_sequence["step_0"]] + full_sequence["sequence"]:
    print(f"Day {step['delay_days']}: {step['subject']}")
```

---

## FAQ: AI Outreach Email API

### How do I automate personalised email outreach?

Call `POST /api/v1/sales/outreach` with a rich prospect description (role, company, signals, pain points) and your product context. You get back a subject line, email body, and follow-up hook in structured JSON — under 2 seconds. Integrate into your CRM webhook, your sequencer (Instantly/Lemlist), or your own microservice. Bring your own Anthropic key (BYOK) so token costs bill to your account.

### What's the best API for sales email generation?

For structured, developer-first outreach generation, `POST /api/v1/sales/outreach` returns `{subject, body, follow_up_hook}` in typed JSON. Supports email, LinkedIn, and SMS channels via the `channel` parameter. BYOK — your Anthropic key, no vendor markup. [See the full API reference →](/docs/api-reference)

### Can AI write outreach emails for me?

Yes — but quality depends on the context you provide. A rich prospect description including company signals, recent news, and role context produces personalised emails that reference specific details. A generic name + title produces a generic email. The [personalisation section](#what-makes-outreach-personalised) above covers exactly what to put in the `prospect` and `context` fields.

### How do I integrate AI outreach into HubSpot?

Set up a HubSpot webhook on contact creation → call `/sales/outreach` with the contact's properties → write the generated subject and body to HubSpot custom contact properties. [HubSpot's webhook documentation](https://developers.hubspot.com/docs/api/webhooks) covers the trigger setup. The [code example above](#wiring-into-hubspot) is a complete implementation.

### What makes outreach email personalised?

Personalisation comes from specificity: referencing the prospect's recent company news, tech stack signals, role-specific pain points, and connecting them to your product's specific value. The difference between *"Hi John"* and *"Congrats on the Series B — I saw your LinkedIn post about pipeline velocity and wanted to share..."* is the context you pass to the API. More detail in the `prospect` field → more specific output.

---

## Related Resources

- [Sales AI API Reference — /sales/outreach + /sales/followup →](/docs/api-reference)
- [Complete AI Sales Workflow Pipeline →](/blog/add-ai-to-sales-workflow)
- [AI Lead Qualification API →](/blog/ai-lead-qualification-api)
- [Sales AI Quickstart →](/docs/quickstart)
- [HubSpot Webhook Documentation](https://developers.hubspot.com/docs/api/webhooks)
- [Anthropic API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)

---
<!-- SCHEMA: TechArticle + FAQPage + HowTo (4-step integration) -->
