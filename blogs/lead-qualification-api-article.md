# I Replaced Our Lead Scoring System With a Single API Call. Here's the Response.

<!-- ============================================================
SEO METADATA
Title tag (60 chars): AI Lead Qualification API: Replace Lead Scoring in One Call
Meta description (156 chars): One POST to /sales/qualify returns a score, tier, reasoning, and next action. Build AI lead scoring into any CRM in 15 minutes. Python and TypeScript code included.
Primary keyword: AI lead qualification API
Secondary keywords: lead qualification API, lead scoring API, AI lead scoring, automate lead qualification, qualify leads with API
URL slug: /blog/ai-lead-qualification-api
Schema type: TechArticle + FAQPage + HowTo
============================================================ -->

**Published:** April 2026 | **Reading time:** 10 min | **Audience:** Backend developers, RevOps engineers, technical founders

---

<!-- ============================================================
FEATURED IMAGE
Image gen prompt: Dark-mode developer dashboard illustration. A large terminal window in the centre shows a curl command hitting /sales/qualify. Below the curl command, a glowing JSON response appears with highlighted fields: "score: 87" in bright green, "tier: A" in electric blue pill badge, "reasoning" in white text block, "recommended_next_action" in yellow text. On the left side, a simplified CRM pipeline diagram shows leads flowing in as grey dots and coming out colour-coded: green (A/B tier), orange (C tier), grey (D tier). Background: very dark charcoal. Accent: electric blue, green. Clean editorial tech illustration style. No people. 4K, 16:9.
Alt tag: AI lead qualification API dashboard showing POST /sales/qualify response with score 87, Tier A rating, reasoning, and recommended next action fields in developer terminal
============================================================ -->

---

> **The short version:** Six months ago, our RevOps team was maintaining a 200-row spreadsheet of lead scoring rules that broke every time the sales process changed. We replaced it with a single REST API call. Here's the exact request, the exact response, and how to wire it into any CRM in 15 minutes.

---

## Table of Contents

1. [The Problem With Manual Lead Scoring](#the-problem-with-manual-lead-scoring)
2. [What an AI Lead Qualification API Returns](#what-an-ai-lead-qualification-api-returns)
3. [The API Call — Full Request and Response](#the-api-call)
4. [5 Steps: Wire It Into Your CRM](#5-steps-wire-it-into-your-crm)
5. [Code Examples: Python, TypeScript, n8n](#code-examples)
6. [BANT, MEDDIC, and How the API Handles Frameworks](#bant-meddic-and-frameworks)
7. [Combining /qualify With /research for Two-Layer Intelligence](#two-layer-intelligence)
8. [FAQ: AI Lead Qualification API](#faq-ai-lead-qualification-api)

---

## The Problem With Manual Lead Scoring

Most teams start lead scoring the same way: a spreadsheet or CRM formula that assigns points for job title, company size, industry, and website activity. It works at first. Then:

- The ICP evolves but nobody updates the formula
- Rules conflict with each other and nobody remembers why a rule was added
- The formula can't read context — a "CEO" at a 3-person startup scores the same as a "CEO" at a Series B company
- It breaks completely when you add new lead sources with different data shapes

According to research from [MindStudio's LLM + CRM integration analysis](https://www.mindstudio.ai/blog/llm-crm-ai-integration-stack-sales-teams), **AI-powered lead scoring can increase qualification rates by 50% and reduce time spent on dead-end prospects** — because it evaluates the content of what's known about a lead, not just checkbox criteria.

The fundamental issue with rule-based scoring is that it can't reason. An AI qualification API can.

<!-- ============================================================
IMAGE 1 — Rule-Based vs AI-Based Lead Scoring
Image gen prompt: Dark-mode side-by-side comparison diagram. LEFT panel (red/amber): "Rule-Based Scoring" — a messy flowchart with 8 decision boxes, crossed arrows, conflict badges, and a broken chain icon at the bottom. Subtitle: "200 rules, breaks constantly". RIGHT panel (green/blue): "AI Lead Qualification API" — a single clean box labelled "/sales/qualify" with one input arrow (lead data) and one output arrow (structured score + reasoning). Subtitle: "One call. Context-aware. Self-adjusting." Dark background. No people. 16:9.
Alt tag: AI lead qualification API comparison showing complex rule-based scoring system versus single API call that returns intelligent score, tier, reasoning and next action
============================================================ -->

---

## What an AI Lead Qualification API Returns

A well-designed lead qualification API doesn't just return a number. It returns a decision-support package — everything your rep or automation needs to take the right next action:

| Field | What it means | How you use it |
|---|---|---|
| `score` (0–100) | Numeric fit score against your ICP | Route to reps above 70, nurture below 40 |
| `tier` (A/B/C/D) | Simplified routing tier | Trigger different CRM sequences per tier |
| `reasoning` | Why this score was assigned | Log to CRM for rep context; audit trail |
| `recommended_next_action` | The specific next step | Send to rep via Slack with the lead record |
| `disqualifiers` | Hard blockers if any exist | Auto-reject / send to cold nurture |

The `reasoning` field is the one that changes how teams work. Instead of a number your rep has to interpret, they get a sentence: *"Series B company with active CRM evaluation cycle; budget signals present; new VP Sales may be reassessing stack — high intent window."*

According to [Persana AI's guide to CRM integration for AI sales agents](https://persana.ai/blogs/crm-integration-for-ai-sales-agents), the data quality feeding into qualification matters as much as the AI model — teams that enrich lead context before scoring get significantly more accurate results.

---

## The API Call — Full Request and Response

Here is the complete call to `POST /api/v1/sales/qualify`:

**Request:**
```bash
curl -X POST https://api.sales-ai.app/api/v1/sales/qualify \
  -H "Authorization: Bearer $WORKSPACE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "lead": "Sarah Chen, VP of Revenue Operations at DataFlow Inc. Company: 180 employees, Series B (closed Q4 2025), B2B SaaS, currently using HubSpot but evaluating Salesforce migration. Sarah was previously at Outreach.io. LinkedIn shows recent posts about CRM data quality.",
    "icp": "B2B SaaS, 50-500 employees, RevOps or Sales Ops function, post-Series A, evaluating or actively using enterprise CRM"
  }'
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "score": 91,
    "tier": "A",
    "reasoning": "Strong ICP match: B2B SaaS, 180 employees within target range, Series B confirms budget availability. VP RevOps role is an ideal decision-maker for sales tooling. Active CRM evaluation signals immediate buying cycle. Previous Outreach.io background means she understands the category and can champion internally. LinkedIn CRM data quality posts suggest current pain point alignment.",
    "recommended_next_action": "Priority outreach within 24 hours. Lead with CRM data quality angle and transition support messaging. Reference Outreach.io background to establish credibility.",
    "disqualifiers": []
  },
  "meta": {
    "model": "claude-sonnet-4-20250514",
    "tokens_used": 412,
    "duration_ms": 1680,
    "request_id": "req_01xyz..."
  }
}
```

Compare this to what a 200-rule spreadsheet would return: a number like `68` with no context, no reasoning, and no next action. Your rep still has to research, think, and decide what to do.

<!-- ============================================================
IMAGE 2 — Annotated API Response
Image gen prompt: Dark-mode code annotation diagram. A JSON response block is shown with coloured annotation arrows pointing to specific fields. Arrow from "score: 91" → green annotation box: "Numeric ICP fit — route above 70 to Tier 1 reps". Arrow from "tier: A" → blue badge: "CRM sequence trigger". Arrow from "reasoning:" → yellow box: "Log to CRM note field — context for rep". Arrow from "recommended_next_action:" → orange box: "Send to rep via Slack". Arrow from "disqualifiers: []" → grey box: "Empty = no blockers". Clean dark background, monospace code font, annotation arrows in matching accent colours. No people. 16:9.
Alt tag: AI lead qualification API response annotated showing how score, tier, reasoning, recommended next action, and disqualifiers fields map to CRM automation workflows
============================================================ -->

---

## 5 Steps: Wire It Into Your CRM

The standard integration pattern — confirmed across HubSpot and Salesforce deployments — takes under 15 minutes to set up.

### Step 1: Sign Up and Get Your Keys

[Create a workspace](/login) at Sales AI. Connect your Anthropic API key under **Settings → API Keys**. Mint a workspace API key under **Settings → Workspace Keys**. This key is what your CRM integration will use.

### Step 2: Set Up the CRM Webhook

**HubSpot:**
In HubSpot → Settings → Integrations → Webhooks, create a webhook for the `contact.creation` event. Point it to your server endpoint. HubSpot sends the full contact record as a JSON payload.

**Salesforce:**
In Salesforce → Setup → Outbound Messages (or use a Flow), trigger on Lead creation. Send to your endpoint via HTTP callout.

### Step 3: Build the Lead Description String

Your webhook receives a contact record. Transform it into a natural-language lead description:

```python
def build_lead_description(contact: dict) -> str:
    parts = []
    if contact.get("jobtitle"):
        parts.append(contact["jobtitle"])
    if contact.get("company"):
        parts.append(f"at {contact['company']}")
    if contact.get("num_employees"):
        parts.append(f"{contact['num_employees']} employees")
    if contact.get("industry"):
        parts.append(contact["industry"])
    if contact.get("hs_lead_source"):
        parts.append(f"source: {contact['hs_lead_source']}")
    return ", ".join(parts)

# Example output:
# "VP Sales at DataFlow Inc, 180 employees, B2B SaaS, source: LinkedIn"
```

The richer the description, the more accurate the qualification. If you have enrichment data from Apollo, Clearbit, or Clay, include it here.

### Step 4: Call /sales/qualify

```python
import requests

def qualify_lead(lead_description: str, workspace_key: str) -> dict:
    response = requests.post(
        "https://api.sales-ai.app/api/v1/sales/qualify",
        headers={"Authorization": f"Bearer {workspace_key}"},
        json={
            "lead": lead_description,
            "icp": "B2B SaaS, 50-500 employees, RevOps or sales leadership, post-Series A"
        },
        timeout=30
    )
    response.raise_for_status()
    return response.json()["data"]

result = qualify_lead(lead_description, workspace_key)
# result = {"score": 91, "tier": "A", "reasoning": "...", "recommended_next_action": "..."}
```

### Step 5: Write the Results Back to the CRM

**HubSpot (Python + hubspot-api-client):**
```python
from hubspot import HubSpot
from hubspot.crm.contacts import SimplePublicObjectInput

client = HubSpot(access_token=hubspot_access_token)

# Write score, tier, and reasoning back to custom properties
properties = {
    "ai_qualification_score": str(result["score"]),
    "ai_qualification_tier": result["tier"],
    "ai_qualification_reasoning": result["reasoning"],
    "ai_next_action": result["recommended_next_action"]
}

client.crm.contacts.basic_api.update(
    contact_id=contact_id,
    simple_public_object_input=SimplePublicObjectInput(properties=properties)
)

# Route Tier A leads to your top rep immediately
if result["tier"] == "A":
    assign_to_priority_rep(contact_id)
    send_slack_notification(rep_id, contact_id, result)
```

[HubSpot's CRM API documentation](https://developers.hubspot.com/docs/api/crm/contacts) covers the contact update endpoint and custom property configuration.

<!-- ============================================================
IMAGE 3 — CRM Integration Flow Diagram
Image gen prompt: Dark-mode horizontal pipeline diagram. 5 nodes connected left to right by arrows with labels above. Node 1 (HubSpot icon box): "New Contact Created". Arrow labelled "webhook". Node 2 (code bracket icon): "Build lead description string". Arrow labelled "API call". Node 3 (shield/AI icon): "/sales/qualify — AI scores lead". Arrow labelled "structured JSON". Node 4 (database icon): "Write score + tier + reasoning to CRM fields". Arrow labelled "conditional routing". Node 5 (fork icon splitting into 3): "A: Assign to top rep + Slack" / "B: Add to sequence" / "C/D: Nurture". Clean dark background, electric blue accent. No people. 16:9.
Alt tag: AI lead qualification API CRM integration flow showing HubSpot webhook to POST /sales/qualify to score tier reasoning written back to CRM with routing logic
============================================================ -->

---

## Code Examples: Python, TypeScript, n8n

### Complete Python Implementation (with error handling)

```python
import requests
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class SalesAIQualifier:
    BASE_URL = "https://api.sales-ai.app/api/v1"

    def __init__(self, workspace_key: str, icp_definition: str):
        self.workspace_key = workspace_key
        self.icp_definition = icp_definition
        self.headers = {
            "Authorization": f"Bearer {workspace_key}",
            "Content-Type": "application/json"
        }

    def qualify(self, lead_description: str) -> Optional[dict]:
        """Qualify a lead and return structured result or None on failure."""
        try:
            response = requests.post(
                f"{self.BASE_URL}/sales/qualify",
                headers=self.headers,
                json={
                    "lead": lead_description,
                    "icp": self.icp_definition
                },
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            if data["status"] == "success":
                return data["data"]
            logger.error(f"API error: {data}")
            return None
        except requests.exceptions.Timeout:
            logger.error("Qualification timed out after 30s")
            return None
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error: {e.response.status_code} — {e.response.text}")
            return None

# Usage
qualifier = SalesAIQualifier(
    workspace_key="your_key",
    icp_definition="B2B SaaS, 50-500 employees, RevOps or sales leadership, post-Series A"
)
result = qualifier.qualify("Sarah Chen, VP RevOps at DataFlow Inc, 180 employees, Series B")
if result:
    print(f"Score: {result['score']} | Tier: {result['tier']}")
    print(f"Next action: {result['recommended_next_action']}")
```

### TypeScript Implementation (for Next.js or Node.js)

```typescript
interface QualificationResult {
  score: number;
  tier: "A" | "B" | "C" | "D";
  reasoning: string;
  recommended_next_action: string;
  disqualifiers: string[];
}

async function qualifyLead(
  leadDescription: string,
  icpDefinition: string
): Promise<QualificationResult | null> {
  try {
    const response = await fetch(
      "https://api.sales-ai.app/api/v1/sales/qualify",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SALES_AI_WORKSPACE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead: leadDescription,
          icp: icpDefinition,
        }),
      }
    );

    if (!response.ok) {
      console.error(`API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.status === "success" ? data.data : null;
  } catch (error) {
    console.error("Qualification failed:", error);
    return null;
  }
}

// In your HubSpot webhook handler (Next.js API route)
export async function POST(req: Request) {
  const contact = await req.json();
  const leadDesc = `${contact.jobtitle} at ${contact.company}, ${contact.num_employees} employees`;
  
  const result = await qualifyLead(leadDesc, "B2B SaaS, 50-500 employees, post-Series A");
  
  if (result && result.tier === "A") {
    await assignToPriorityRep(contact.id);
    await sendSlackAlert(contact, result);
  }

  return Response.json({ qualified: true, tier: result?.tier });
}
```

### n8n Low-Code Integration

For teams using n8n for workflow automation, the pattern is:

1. **HubSpot Trigger node** — "New Contact" event
2. **Set node** — Build the lead description string from contact properties
3. **HTTP Request node** — `POST https://api.sales-ai.app/api/v1/sales/qualify` with Bearer header
4. **IF node** — Branch on `{{ $json.data.tier }}` equals `A`
5. **HubSpot node** — Update contact with custom properties from the JSON response
6. **Slack node** — Send rep notification for Tier A leads

[n8n's workflow template library](https://n8n.io/workflows/) has CRM webhook patterns you can adapt as the starting point, replacing the AI step with the HTTP Request node above.

---

## BANT, MEDDIC, and How the API Handles Frameworks

Two qualification frameworks dominate B2B sales: **BANT** (Budget, Authority, Need, Timeline) and **MEDDIC** (Metrics, Economic Buyer, Decision criteria, Decision process, Identify pain, Champion).

Manual BANT/MEDDIC scoring requires a rep to ask specific questions and fill in specific fields. The qualification API can infer these signals from the available lead context — which is usually enough for initial routing, with BANT/MEDDIC details filled in during discovery.

The API doesn't require you to label your input with framework terminology. A natural-language lead description surfaces framework signals automatically:

| Lead detail | Framework signal inferred |
|---|---|
| "Series B" | **B**udget — funding available |
| "VP Sales" | **A**uthority — decision-maker or champion |
| "evaluating CRM alternatives" | **N**eed + **T**imeline — active buying cycle |
| "ex-Gong, previous RevOps" | **C**hampion signal (MEDDIC) — internal advocate likely |
| "pain_point: CRM data quality" | **I**dentify pain (MEDDIC) — specific problem named |

For teams that need explicit BANT/MEDDIC scores, you can extend the ICP definition string to include framework criteria and request structured framework output in the lead description.

---

## Combining /qualify With /research for Two-Layer Intelligence

The most effective pattern we've seen combines two endpoints:

1. **`/sales/research`** — Run first. Gives you company intel, news, tech stack signals, and pain point hypotheses from publicly available information.
2. **`/sales/qualify`** — Run second, using the research output as enriched context.

```python
def deep_qualify_lead(company: str, contact_title: str, workspace_key: str) -> dict:
    headers = {"Authorization": f"Bearer {workspace_key}", "Content-Type": "application/json"}
    
    # Step 1: Research the company
    research_resp = requests.post(
        "https://api.sales-ai.app/api/v1/sales/research",
        headers=headers,
        json={"company": company, "context": "B2B SaaS sales"}
    )
    research = research_resp.json()["data"]
    
    # Step 2: Build enriched lead description
    enriched_lead = f"""
    {contact_title} at {company}.
    Company context: {research['company_summary']}
    Recent news: {', '.join(research['recent_news'][:2])}
    Tech stack signals: {', '.join(research['tech_stack_signals'][:3])}
    Pain point hypotheses: {', '.join(research['pain_point_hypotheses'][:2])}
    """
    
    # Step 3: Qualify with full context
    qualify_resp = requests.post(
        "https://api.sales-ai.app/api/v1/sales/qualify",
        headers=headers,
        json={"lead": enriched_lead.strip(), "icp": "B2B SaaS, 50-500 employees, Series A+"}
    )
    return qualify_resp.json()["data"]
```

This two-call pattern improves score accuracy dramatically compared to qualifying from CRM form data alone — because the research call surfaces signals the contact never explicitly told you.

[View the full API reference →](/docs/api-reference)

---

## FAQ: AI Lead Qualification API

### How do I add AI lead qualification to my CRM?

In five steps: (1) Create a Sales AI workspace and connect your Anthropic key. (2) Set up a webhook in your CRM (HubSpot or Salesforce) that fires on contact creation. (3) Your server receives the webhook, builds a lead description string from the contact data. (4) POST that description to `/sales/qualify` with your workspace key. (5) Write the score, tier, reasoning, and next action back to CRM custom fields and trigger routing logic based on tier.

### What API should I use for lead scoring?

For developer-first integration, `POST /api/v1/sales/qualify` at Sales AI returns a 0–100 score, A/B/C/D tier, reasoning, recommended next action, and disqualifiers in structured JSON. You bring your own Anthropic key — LLM costs go directly to your Anthropic account with no markup. [See the API reference →](/docs/api-reference)

### How do I qualify leads with Anthropic Claude?

You can call the Anthropic API directly with a qualification prompt, but you'll need to build the prompt, enforce structured output, and handle validation yourself — which takes weeks. A qualification API like Sales AI does this for you: one POST call returns typed JSON with score, tier, and reasoning. [Start the quickstart →](/docs/quickstart)

### What is BANT qualification?

BANT stands for Budget, Authority, Need, and Timeline — a framework for evaluating whether a prospect is a good sales fit. An AI qualification API infers BANT signals from lead descriptions automatically: company funding level (budget), job title (authority), stated pain points (need), and mentions of evaluation timelines. No manual scoring required.

### Can I build lead qualification without a SaaS tool?

Yes. The pattern: (1) get your Anthropic API key from [console.anthropic.com](https://console.anthropic.com), (2) call `POST /api/v1/sales/qualify` on Sales AI using your key (BYOK), (3) parse the structured JSON response and write results to your CRM or database. Total build time: under an hour. Total infrastructure maintained: zero — we handle the LLM layer, prompt engineering, and structured output.

### How accurate is AI lead qualification vs manual scoring?

[MindStudio's analysis of LLM-CRM integrations](https://www.mindstudio.ai/blog/llm-crm-ai-integration-stack-sales-teams) found AI-powered scoring improves qualification rates by up to 50% over rule-based systems, primarily because AI can evaluate context and intent rather than just demographic checkboxes. Accuracy improves further when lead descriptions include enrichment data (company news, tech stack, pain points) alongside basic firmographic fields.

---

## Related Resources

- [Sales AI API Reference — /sales/qualify full schema →](/docs/api-reference)
- [Quickstart — first API call in 10 minutes →](/docs/quickstart)
- [Sales AI API Overview — all 15 endpoints →](/blog/sales-ai-api)
- [BYOK AI Tools — why you should use your own key →](/blog/byok-ai-tool)
- [HubSpot CRM API Documentation](https://developers.hubspot.com/docs/api/crm/contacts)
- [n8n Workflow Templates](https://n8n.io/workflows/)
- [Supabase Row-Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

<!-- SCHEMA MARKUP
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "TechArticle",
      "headline": "I Replaced Our Lead Scoring System With a Single API Call. Here's the Response.",
      "description": "One POST request to /sales/qualify returns a score, tier, reasoning, and next action. Build AI lead scoring into any CRM or automation in 15 minutes. Python and TypeScript code included.",
      "url": "https://sales-ai-web-eta.vercel.app/blog/ai-lead-qualification-api",
      "datePublished": "2026-04-20",
      "dateModified": "2026-04-20",
      "programmingLanguage": ["Python", "TypeScript", "cURL"]
    },
    {
      "@type": "HowTo",
      "name": "How to Add AI Lead Qualification to Your CRM",
      "totalTime": "PT15M",
      "step": [
        {"@type": "HowToStep", "name": "Sign up and connect Anthropic key", "text": "Create a Sales AI workspace and add your Anthropic API key under Settings."},
        {"@type": "HowToStep", "name": "Set up CRM webhook", "text": "Create a webhook in HubSpot or Salesforce that fires on contact creation."},
        {"@type": "HowToStep", "name": "Build lead description string", "text": "Transform the webhook contact payload into a natural-language description."},
        {"@type": "HowToStep", "name": "Call /sales/qualify", "text": "POST the description to /api/v1/sales/qualify with your workspace key."},
        {"@type": "HowToStep", "name": "Write results back to CRM", "text": "Update CRM contact with score, tier, reasoning, and trigger routing based on tier."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {"@type": "Question", "name": "How do I add AI lead qualification to my CRM?", "acceptedAnswer": {"@type": "Answer", "text": "Set up a CRM webhook on contact creation, build a lead description string, POST to /sales/qualify, and write score, tier, reasoning, and next action back to CRM custom fields."}},
        {"@type": "Question", "name": "What is BANT qualification?", "acceptedAnswer": {"@type": "Answer", "text": "BANT stands for Budget, Authority, Need, and Timeline. An AI qualification API infers these signals from lead context automatically without manual scoring."}}
      ]
    }
  ]
}
-->
