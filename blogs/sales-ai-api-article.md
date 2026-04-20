# Sales AI API: 15 Production-Ready Endpoints for Lead Qualification, Outreach, Prospecting & More

<!-- ============================================================
SEO METADATA
Title tag (57 chars):  Sales AI API: 15 Endpoints for Lead Qualification & Outreach
Meta description (158 chars): REST endpoints for qualifying leads, writing outreach, researching prospects & more. Full BYOK — your Anthropic key, your costs. See what you can build in 10 minutes.
Primary keyword: sales AI API
Secondary keywords: AI sales API, sales AI endpoints, BYOK sales API, lead qualification API, AI outreach API, sales automation API
URL slug: /blog/sales-ai-api
Canonical: https://sales-ai-web-eta.vercel.app/blog/sales-ai-api
Schema type: TechArticle + FAQPage + HowTo
============================================================ -->

**Published:** April 2026 | **Reading time:** 13 min | **Audience:** Backend developers, technical founders, RevOps engineers

---

<!-- ============================================================
FEATURED IMAGE
Image gen prompt: Cinematic dark-mode developer workspace flat illustration. A large glowing API endpoint diagram floats in the centre, showing 15 labelled hexagonal nodes arranged in a circuit-board pattern, each node labelled with endpoint names like /sales/qualify, /sales/research, /sales/outreach in clean monospace font. Connecting lines pulse with soft cyan and electric-blue light. A minimalist code editor panel occupies the right third showing Python syntax with green highlighted JSON response. Background is deep charcoal #0D0D0D with subtle grid lines. Brand accent colour: electric blue #3B82F6. Style: professional tech editorial, not abstract. No people. Ultra-detailed, 4K quality, wide 16:9 aspect ratio.
Alt tag: Sales AI API architecture diagram showing 15 REST endpoints for lead qualification, outreach, and prospect research connected in a circuit-board layout on a dark developer dashboard
============================================================ -->

---

> **TL;DR — What is a Sales AI API?**
> A sales AI API is a REST interface that exposes purpose-built AI capabilities for sales tasks — lead qualification, prospect research, outreach generation, objection handling, proposal writing, and more. Unlike a generic LLM API (raw Anthropic or OpenAI), a sales AI API returns *structured, sales-specific JSON* you can act on directly in code. Sales AI ships 15 of these endpoints under `POST /api/v1/sales/*`. You bring your own Anthropic API key (BYOK), so LLM costs hit your account — not ours.

---

## Table of Contents

1. [What Is a Sales AI API?](#what-is-a-sales-ai-api)
2. [Why Not Just Call Anthropic or OpenAI Directly?](#why-not-just-call-anthropic-or-openai-directly)
3. [The 15 Sales AI Endpoints (With Examples)](#the-15-sales-ai-endpoints)
   - [Prospecting & Intelligence](#prospecting--intelligence)
   - [Outreach & Sequencing](#outreach--sequencing)
   - [Deal Execution](#deal-execution)
   - [Reporting & Utilities](#reporting--utilities)
4. [BYOK: How Bring-Your-Own-Key Works](#byok-how-bring-your-own-key-works)
5. [The Async Job Engine: How Long-Running Tasks Work](#the-async-job-engine)
6. [7-Language Code Snippets](#7-language-code-snippets)
7. [How to Wire a Sales AI API Into Your Stack](#how-to-wire-a-sales-ai-api-into-your-stack)
8. [Security: How API Keys Are Protected](#security-how-api-keys-are-protected)
9. [FAQ: Sales AI API](#faq-sales-ai-api)

---

## What Is a Sales AI API?

A **sales AI API** is a REST API that gives developers programmatic access to AI-powered sales intelligence — structured endpoints you call with HTTP requests and get structured JSON responses back.

The key distinction from a general-purpose LLM API is *specificity*. When you call `POST /api/v1/sales/qualify` with a lead description, you don't get a blob of markdown text you have to parse. You get a structured payload:

```json
{
  "status": "success",
  "data": {
    "score": 87,
    "tier": "A",
    "reasoning": "Series B company with active CRM investment signals budget and intent to solve pipeline problems.",
    "recommended_next_action": "Schedule discovery call — lead with ROI angle and reference CRM cost reduction.",
    "disqualifiers": []
  },
  "meta": {
    "model": "claude-sonnet-4-20250514",
    "tokens_used": 318,
    "duration_ms": 1920,
    "request_id": "req_01abc..."
  }
}
```

That `score`, `tier`, `reasoning`, and `recommended_next_action` are fields your code can read, store, route, and act on. No parsing. No ambiguity.

**This article is for:** backend developers, technical founders, and RevOps engineers who want to embed AI sales capabilities into their own stack — CRMs, automation tools, internal dashboards, or SaaS products — without building LLM infrastructure from scratch.

According to [HubSpot's 2025 State of Sales Report](https://blog.hubspot.com/sales/hubspot-sales-strategy-report), **37% of sales reps now use AI tools more than any other sales tool**, and 84% report that AI saves time and optimises processes. Yet the overwhelming majority of available AI sales tools are UI-first SaaS platforms that don't expose a programmable API. Sales AI is built differently: API-first, BYOK, and designed to be embedded.

<!-- ============================================================
IMAGE 1 — After the intro paragraph
Image gen prompt: Clean infographic illustration on deep navy background. Two side-by-side comparison panels. Left panel labelled "Generic LLM API" shows a raw unstructured text blob response in a code terminal, messy and unhighlighted. Right panel labelled "Sales AI API" shows clean, structured JSON with colour-coded keys: score in green, tier in blue, reasoning in white, recommended_next_action in yellow. Arrow pointing from left to right with label "Structure + Sales Context". Minimal flat design, professional, no people. 16:9.
Alt tag: Comparison of generic LLM API raw text response versus structured Sales AI API JSON response showing score, tier, reasoning and recommended next action fields
============================================================ -->

---

## Why Not Just Call Anthropic or OpenAI Directly?

It's a fair question. The [Anthropic API](https://platform.claude.com/docs/en/home) and OpenAI APIs are excellent foundation layers. But building production sales automation on top of raw LLM APIs requires five layers of undifferentiated engineering:

1. **Prompt engineering for every task.** Writing stable, production-grade prompts for lead qualification, proposal generation, objection handling, and competitor analysis takes weeks of iteration and ongoing maintenance. Each task needs different schemas, output formats, and guardrails.

2. **Structured output enforcement.** Raw LLM responses return free-form text. Getting consistent JSON with typed fields — score, tier, reasoning, next action — requires function-calling schemas, retries, and validation layers. According to [Anthropic's own prompt engineering documentation](https://platform.claude.com/docs/en/home), reliable structured outputs require careful system prompt engineering that changes with every model version.

3. **Async infrastructure for long-running tasks.** Prospect discovery and lead enrichment take 30–90 seconds. Synchronous HTTP calls time out at the CDN or load-balancer layer. You need a job queue, polling endpoints, status tracking, and dead-letter handling for failures — a significant infrastructure project.

4. **Usage tracking and cost visibility.** Which endpoint is costing the most? Which workspace is burning tokens? Building per-endpoint, per-key usage dashboards is undifferentiated engineering that doesn't move your product forward.

5. **Multi-tenant key management.** If you're building for multiple clients or teams, storing and isolating Anthropic keys per workspace — with AES-256-GCM encryption and row-level security — is a substantial security project. The Anthropic API documentation covers [model pricing](https://platform.claude.com/docs/en/about-claude/pricing) but leaves all key management architecture to the builder.

A sales AI API solves all five. You call one endpoint. You get typed data back. We handle everything underneath.

---

## The 15 Sales AI Endpoints

Sales AI organises its 15 endpoints into four functional groups covering the full sales cycle. All endpoints live under `https://api.sales-ai.app/api/v1/` and accept `Authorization: Bearer <workspace_key>`.

<!-- ============================================================
IMAGE 2 — Sales Cycle Endpoint Map (before endpoint groups)
Image gen prompt: Horizontal funnel diagram on a dark charcoal background (#1A1A2E). The funnel has four sections from left to right, each with a different accent colour. Section 1 (purple): "Prospecting & Intelligence" with 5 endpoint pill badges below: /research, /icp, /competitors, /prospect, /contacts. Section 2 (blue): "Outreach & Sequencing" with 4 endpoint pills: /outreach, /followup, /leads, /quick. Section 3 (green): "Deal Execution" with 5 pills: /qualify, /prep, /proposal, /objections. Section 4 (orange): "Reporting" with 2 pills: /report, /report-pdf. Each pill has a small API icon prefix. Clean, sharp, editorial tech design. No people. 16:9 wide.
Alt tag: Sales AI API endpoint map showing 15 REST endpoints grouped across the sales funnel: prospecting and intelligence, outreach and sequencing, deal execution, and reporting
============================================================ -->

### Prospecting & Intelligence

These five endpoints power the top of the funnel — discovering, researching, and profiling prospects before you reach out.

---

#### `POST /sales/research`

**What it does:** Deep-dive company and contact research before a call. Returns company summary, recent news signals, tech stack hypotheses, pain point analysis, and conversation hooks — synthesised from publicly available signals.

**Example request:**
```bash
curl -X POST https://api.sales-ai.app/api/v1/sales/research \
  -H "Authorization: Bearer $WORKSPACE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"company": "Acme Corp", "context": "B2B SaaS, 200 employees, uses Salesforce"}'
```

**Response shape:**
```json
{
  "data": {
    "company_summary": "...",
    "recent_news": ["Series B raise Q1 2026", "VP Sales hired from Gong"],
    "tech_stack_signals": ["Salesforce", "Outreach", "ZoomInfo"],
    "pain_point_hypotheses": ["SDR capacity constraints", "pipeline visibility"],
    "conversation_hooks": ["New VP may be re-evaluating current stack"]
  }
}
```

---

#### `POST /sales/icp`

**What it does:** Scores a lead against your defined Ideal Customer Profile (ICP). Returns a fit score (0–100), matching criteria, gaps, and a recommendation. No ML training required — you define the ICP in plain language.

**Example request:**
```bash
curl -X POST https://api.sales-ai.app/api/v1/sales/icp \
  -H "Authorization: Bearer $WORKSPACE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "lead": "TechCorp, 150 employees, Series A, RevOps team of 2",
    "icp_definition": "B2B SaaS, 50–500 employees, RevOps or Sales Ops function, uses HubSpot or Salesforce"
  }'
```

---

#### `POST /sales/competitors`

**What it does:** Generates competitive intelligence on demand. Returns competitor strengths, weaknesses, your differentiators, and a ready-to-use battle card.

**Use case:** Trigger this endpoint automatically when a competitor name is mentioned in a CRM note — auto-generate a battle card for your rep before their next call. According to research from [Gartner on sales enablement](https://www.gartner.com/en/sales/topics/sales-enablement), reps who have access to real-time competitive intelligence close deals at significantly higher rates than those who don't.

---

#### `POST /sales/prospect` *(async)*

**What it does:** Discovers and profiles prospects matching your ICP criteria. Runs as a background job — returns a `job_id` immediately, results available via polling or webhook. See [The Async Job Engine](#the-async-job-engine) for the full pattern.

---

#### `POST /sales/contacts`

**What it does:** Enriches a contact record. Returns profile summary, role context, likely priorities, and engagement tips to help your rep open strong.

---

### Outreach & Sequencing

<!-- ============================================================
IMAGE 3 — Outreach Sequencing Visual (before this section)
Image gen prompt: Dark-mode UI mockup showing an email sequence builder. Three email cards stacked vertically with connecting vertical timeline line between them. Card 1 (Step 1, Day 0): subject line and preview text visible. Card 2 (Step 2, Day 3): "Follow-up" badge. Card 3 (Step 3, Day 10): "Re-engage" badge. Each card shows a code snippet overlay on hover: "POST /sales/followup" in cyan monospace. A small JSON badge in the top-right corner shows {"steps": 3, "channel": "email"}. Background: very dark navy. Accent: electric blue. No people. Clean flat illustration style, 16:9.
Alt tag: Sales AI API outreach sequencing endpoint showing automated multi-step email follow-up generation with POST /sales/followup REST API call
============================================================ -->

Four endpoints for generating and sequencing personalised sales communications.

---

#### `POST /sales/outreach`

**What it does:** Generates personalised first-touch outreach copy. Accepts prospect context and returns a subject line and email body. Supports `channel: "email" | "linkedin" | "sms"`.

**Example request:**
```python
import requests

response = requests.post(
    "https://api.sales-ai.app/api/v1/sales/outreach",
    headers={"Authorization": f"Bearer {workspace_key}"},
    json={
        "prospect": "Jane Smith, VP Sales at Acme Corp, ex-Gong, just raised Series B",
        "context": "Sales AI is a BYOK API for AI sales automation — 15 endpoints, developer-first",
        "channel": "email"
    }
)
data = response.json()["data"]
print(data["subject"])   # → "Acme's Series B + a question about your sales stack"
print(data["body"])      # → Full personalised email body
```

A 2025 analysis by [Cirrus Insight](https://www.cirrusinsight.com/blog/ai-in-sales) found that **73% of sales professionals report AI has significantly improved team productivity** — the biggest gains come from eliminating manual outreach personalisation.

---

#### `POST /sales/followup`

**What it does:** Generates a multi-step follow-up sequence. Accepts the original outreach message for continuity. Returns an array of follow-ups with recommended delay in days.

**Response shape:**
```json
{
  "data": {
    "sequence": [
      {"step": 1, "delay_days": 3, "subject": "...", "body": "..."},
      {"step": 2, "delay_days": 7, "subject": "...", "body": "..."},
      {"step": 3, "delay_days": 14, "subject": "...", "body": "..."}
    ]
  }
}
```

---

#### `POST /sales/leads` *(async)*

**What it does:** Discovers inbound leads with buying intent signals. Like `/sales/prospect` but focused on active intent rather than static ICP fit. Runs async with the same polling pattern.

---

#### `POST /sales/quick`

**What it does:** Fast, synchronous sales queries — no queue, instant response. Use for short-form tasks: draft a subject line variant, check a competitor claim, rewrite a paragraph on the fly.

---

### Deal Execution

<!-- ============================================================
IMAGE 4 — Lead Qualification Score Card (after "Deal Execution" heading, before /qualify)
Image gen prompt: Dark UI card component mockup. A "Lead Qualification Result" card showing: a large circular score gauge reading "87" in bold white with a green arc around it, a tier badge showing "Tier A" in green pill. Below that, two sections side by side: "Reasoning" (text block with green checkmark icon) and "Disqualifiers" (empty state with grey dash). Bottom bar shows "Recommended Next Action: Schedule discovery call within 48 hours" in yellow text with an arrow icon. Background: dark charcoal. Design feels like a developer dashboard card component, not a sales tool. No people. 16:9 flat illustration.
Alt tag: Sales AI API lead qualification result card showing score of 87, Tier A rating, reasoning summary and recommended next action from POST /sales/qualify endpoint
============================================================ -->

Five endpoints that power the middle of the funnel — qualifying, prepping, objection handling, and closing.

---

#### `POST /sales/qualify`

**What it does:** Lead scoring and qualification with explicit reasoning. Returns a numeric score (0–100), tier (A/B/C/D), reasoning, recommended next action, and any disqualifiers. Maps directly to BANT and MEDDIC frameworks without requiring you to implement either.

**Example response:**
```json
{
  "data": {
    "score": 84,
    "tier": "A",
    "reasoning": "Clear budget signal from Series B raise; active CRM evaluation; team size matches ICP...",
    "recommended_next_action": "Schedule discovery call within 48 hours",
    "disqualifiers": []
  }
}
```

According to McKinsey's [2025 research on AI in sales](https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights), AI-powered lead scoring has been shown to increase sales-ready leads by up to 50% while reducing acquisition costs by up to 60% through enhanced targeting.

---

#### `POST /sales/prep`

**What it does:** Pre-call meeting prep and talk track. Accepts company, contact, meeting type (`discovery | demo | negotiation | renewal`), and any context you have. Returns a briefing, key questions, talk track, and watch-outs.

**Use case:** Trigger automatically when a meeting is booked in Calendly — use their webhook to fire this endpoint and send the rep a prep brief via Slack 30 minutes before the call.

---

#### `POST /sales/proposal`

**What it does:** Full proposal generation. Accepts company name, problem statement, solution outline, and optional pricing. Returns a structured document: executive summary, problem statement, proposed solution, investment section, and next steps — ready to paste into your proposal tool.

---

#### `POST /sales/objections`

**What it does:** Objection handling, deal-specific. Accepts the objection as stated and deal context. Returns a reframe, a response, supporting proof points, and a follow-up question.

**Example:** Input `"It's too expensive"` + deal context → returns reframe as ROI/cost-of-inaction, a direct response with specific numbers, 2 supporting proof points, and a follow-up question designed to uncover the real underlying blocker.

---

### Reporting & Utilities

#### `POST /sales/report`

**What it does:** Sales performance reporting. Accepts pipeline data, metrics, or raw notes. Returns a summary, highlights, concerns, and recommendations. Supports `format: "narrative" | "structured"`.

---

#### `POST /sales/report-pdf`

**What it does:** Same as `/sales/report` but returns a base64-encoded PDF — ready to email to stakeholders or attach to a CRM record.

---

## BYOK: How Bring-Your-Own-Key Works

<!-- ============================================================
IMAGE 5 — BYOK Architecture Flow Diagram
Image gen prompt: Clean technical flow diagram on dark charcoal background. Horizontal left-to-right architecture showing 4 nodes connected by arrows: Node 1 (developer laptop icon, label "Your Code") → Node 2 (shield icon with lock, label "Sales AI API — AES-256-GCM Key Vault") → Node 3 (Anthropic logo-style purple hexagon, label "Anthropic API — Your Key Used Here") → Node 4 (database cylinder, label "Anthropic Bills YOUR Account"). A separate branch from Node 2 has an arrow downward to a small invoice icon labelled "Sales AI Bills Platform Fee Only". Clean flat vector illustration, electric blue accent (#3B82F6), no gradients except subtle glow on shield. No people. 16:9.
Alt tag: BYOK sales AI API architecture diagram showing how Anthropic API key flows from developer code through AES-256-GCM encrypted vault to Anthropic billing without vendor markup
============================================================ -->

**BYOK (Bring Your Own Key)** means you provide your own Anthropic API key. Every token you spend is billed directly by Anthropic to your account. Sales AI sits between you and the model — but we never proxy billing, never see your usage, and charge zero markup on tokens.

Here is the complete call flow:

```
Your Code
    ↓
POST /api/v1/sales/qualify
Authorization: Bearer YOUR_WORKSPACE_KEY
    ↓
Sales AI API (Render backend)
  → Decrypt your Anthropic key from AES-256-GCM vault
  → Call Anthropic API with your key (x-api-key header)
  → Structure the response into typed JSON envelope
  → Return to your code
    ↓
Anthropic bills YOUR Anthropic account for tokens consumed
Sales AI bills YOU for platform access only — never for tokens
```

This model is gaining traction rapidly across developer tooling. According to a 2025 analysis by [BYOKList](https://byoklist.com/), the BYOK model has become the preferred pricing architecture for developer-first AI tools precisely because it **separates platform value from compute costs** — eliminating the opacity of "unlimited AI" subscriptions where nobody knows what the actual per-call cost is.

**Why BYOK matters in practice:**

- **No markup.** You pay [Anthropic's published token rates](https://platform.claude.com/docs/en/about-claude/pricing) — Claude Sonnet is $3/MTok input and $15/MTok output — not a vendor-inflated per-call fee.
- **Full visibility.** You see exact token spend in your Anthropic console, broken down by API key and request.
- **No vendor lock-in on costs.** Your LLM spend scales with Anthropic's pricing improvements — as Anthropic cuts prices (they have consistently), you benefit immediately.
- **Key ownership.** Your Anthropic key is yours. We encrypt it at rest with AES-256-GCM and never log, expose, or transmit it outside the call context. [See full security architecture →](/security)

---

## The Async Job Engine

<!-- ============================================================
IMAGE 6 — Async Job Queue Polling Pattern
Image gen prompt: Vertical step-by-step technical diagram on dark background. 4 steps shown as connected horizontal timeline with numbered circular badges. Step 1 (cyan circle, "1"): shows code snippet "POST /sales/prospect → {job_id: 'job_01abc'}". Step 2 (blue circle, "2"): shows "GET /jobs/job_01abc → {status: 'running'}". Step 3 (purple circle, "3"): shows "GET /jobs/job_01abc → {status: 'completed', result: {...}}". Step 4 (green circle, "4"): shows webhook icon with label "OR: Receive webhook on completion". Clean dark-mode developer illustration. Monospace code fonts. No people. 16:9.
Alt tag: Sales AI API async job engine flow diagram showing four-step pattern: submit prospect job, poll for running status, receive completed results, or configure webhook delivery
============================================================ -->

Two endpoints run as background jobs because they are too intensive for a 30-second synchronous HTTP timeout: `/sales/prospect` and `/sales/leads`. This is the same async pattern used by production-grade APIs like Stripe, Twilio, and the [OpenAI Batch API](https://platform.openai.com/docs/guides/batch).

Here is the complete implementation:

### Step 1: Submit the Job

```python
import requests
import time

# Submit the prospecting job
response = requests.post(
    "https://api.sales-ai.app/api/v1/sales/prospect",
    headers={"Authorization": f"Bearer {workspace_key}"},
    json={
        "criteria": "B2B SaaS companies, 50-200 employees, Series A or B, VP Sales or Head of RevOps",
        "limit": 25
    }
)

job = response.json()
job_id = job["job_id"]
print(f"Job submitted: {job_id}")  # → "job_submitted: job_01abc..."
print(f"Poll at: {job['poll_url']}")
```

### Step 2: Poll for Results

```python
while True:
    status_response = requests.get(
        f"https://api.sales-ai.app/api/v1/jobs/{job_id}",
        headers={"Authorization": f"Bearer {workspace_key}"}
    )
    status = status_response.json()

    if status["status"] == "completed":
        prospects = status["result"]["prospects"]
        print(f"Found {len(prospects)} prospects")
        break
    elif status["status"] == "failed":
        print(f"Job failed: {status['error']}")
        break
    elif status["status"] in ["queued", "running"]:
        print(f"Still {status['status']}... waiting 3 seconds")
        time.sleep(3)
```

### Step 3: Or Use Webhooks (Recommended for Production)

Configure a webhook endpoint in **Settings → Webhooks**. Sales AI POSTs results to your URL on completion — no polling loop required:

```json
{
  "event": "job.completed",
  "job_id": "job_01abc...",
  "result": {
    "prospects": [
      {
        "company": "...",
        "contact": "...",
        "icp_score": 91,
        "research_summary": "..."
      }
    ]
  },
  "timestamp": "2026-04-20T14:32:11Z"
}
```

All webhook requests include an `X-Sales-AI-Signature` HMAC header for verification. Failed deliveries retry with exponential backoff. Jobs that exhaust retries land in a dead-letter queue — never silently dropped. This follows the webhook reliability patterns described by [Stripe's webhook documentation](https://stripe.com/docs/webhooks), the industry standard for production-grade async event delivery. [Full webhook reference →](/docs/api-reference#webhooks)

---

## 7-Language Code Snippets

<!-- ============================================================
IMAGE 7 — Language Tab Switcher
Image gen prompt: Dark-mode code editor mockup with a horizontal tab bar at the top showing 7 language tabs: "cURL", "Python", "TypeScript", "JavaScript", "Go", "PHP", "Ruby". The Python tab is active (highlighted in electric blue underline). The code panel below shows Python syntax with: import requests at top, a POST call to the API, and a two-line print statement showing data["score"] and data["tier"]. Green syntax highlighting for strings, blue for keywords. Authentic VS Code-style editor look. No people. 16:9 flat design.
Alt tag: Sales AI API code snippets showing Python, TypeScript, Go, PHP and Ruby language support for REST API calls to /sales/qualify endpoint in dark mode code editor
============================================================ -->

Every endpoint ships with verified, production-ready code in all 7 supported languages. Here is `/sales/qualify` across all of them.

**cURL**
```bash
curl -X POST https://api.sales-ai.app/api/v1/sales/qualify \
  -H "Authorization: Bearer $WORKSPACE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"lead": "Acme Corp, 500 employees, Series B, uses Salesforce"}'
```

**Python**
```python
import requests

r = requests.post(
    "https://api.sales-ai.app/api/v1/sales/qualify",
    headers={"Authorization": f"Bearer {workspace_key}"},
    json={"lead": "Acme Corp, 500 employees, Series B, uses Salesforce"}
)
print(r.json()["data"]["score"])  # → 87
print(r.json()["data"]["tier"])   # → "A"
```

**TypeScript**
```typescript
const response = await fetch("https://api.sales-ai.app/api/v1/sales/qualify", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${workspaceKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    lead: "Acme Corp, 500 employees, Series B, uses Salesforce",
  }),
});

const { data } = await response.json();
console.log(data.score);  // 87
console.log(data.tier);   // "A"
```

**Go**
```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

func main() {
    payload, _ := json.Marshal(map[string]string{
        "lead": "Acme Corp, 500 employees, Series B, uses Salesforce",
    })

    req, _ := http.NewRequest("POST",
        "https://api.sales-ai.app/api/v1/sales/qualify",
        bytes.NewBuffer(payload))
    req.Header.Set("Authorization", "Bearer "+workspaceKey)
    req.Header.Set("Content-Type", "application/json")

    resp, _ := (&http.Client{}).Do(req)
    defer resp.Body.Close()

    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)
    fmt.Println(result["data"])
}
```

**PHP**
```php
<?php
$response = file_get_contents('https://api.sales-ai.app/api/v1/sales/qualify', false,
    stream_context_create([
        'http' => [
            'method'  => 'POST',
            'header'  => "Authorization: Bearer {$workspaceKey}\r\nContent-Type: application/json\r\n",
            'content' => json_encode(['lead' => 'Acme Corp, 500 employees, Series B, uses Salesforce'])
        ]
    ])
);
$data = json_decode($response, true)['data'];
echo $data['score'];  // 87
echo $data['tier'];   // "A"
```

**Ruby**
```ruby
require 'net/http'
require 'json'

uri  = URI('https://api.sales-ai.app/api/v1/sales/qualify')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true

req = Net::HTTP::Post.new(uri.path)
req['Authorization'] = "Bearer #{workspace_key}"
req['Content-Type']  = 'application/json'
req.body = { lead: 'Acme Corp, 500 employees, Series B, uses Salesforce' }.to_json

resp = http.request(req)
data = JSON.parse(resp.body)['data']
puts data['score']  # 87
puts data['tier']   # "A"
```

**JavaScript (Node.js)**
```javascript
const fetch = require('node-fetch');

const { data } = await (await fetch('https://api.sales-ai.app/api/v1/sales/qualify', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${workspaceKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ lead: 'Acme Corp, 500 employees, Series B, uses Salesforce' }),
})).json();

console.log(data.score);  // 87
console.log(data.tier);   // "A"
```

The full OpenAPI spec is available at `https://api.sales-ai.app/api/v1/openapi.json` — importable directly into Postman, Insomnia, or any OpenAPI-compatible IDE. [Browse the API reference →](/docs/api-reference)

---

## How to Wire a Sales AI API Into Your Stack

<!-- ============================================================
IMAGE 8 — Integration Architecture Diagram
Image gen prompt: Clean dark-mode system integration diagram. Three integration patterns shown as separate horizontal rows. Row 1 "CRM Webhook Pattern": HubSpot icon → arrow → Sales AI API box (/sales/qualify) → arrow → CRM field update icon, with labels at each step. Row 2 "Meeting Prep Pattern": Calendly icon → arrow → /sales/research + /sales/prep box → arrow → Slack notification icon. Row 3 "Async Batch Pattern": Cron clock icon → arrow → /sales/prospect (async) box → arrow → Job queue icon → arrow → Webhook delivery icon. Each row has a different accent colour (blue, green, orange). Clean flat vector style, dark background. No people. 16:9.
Alt tag: Sales AI API integration patterns diagram showing CRM webhook qualification, meeting prep automation, and async batch prospecting workflows wired into HubSpot, Calendly, and Slack
============================================================ -->

The most common integration patterns developers build with Sales AI:

### Pattern 1: CRM Webhook → Qualify → Write Back

When a new lead is created in HubSpot or Salesforce, their webhook fires to your server. You call `/sales/qualify` with the lead data. You write the score and tier back to the CRM as custom fields. Tier A leads route immediately to your top reps.

```
HubSpot "New Contact" webhook
    → POST /sales/qualify {lead: contact_description}
    → Write score, tier, reasoning to HubSpot custom properties
    → If tier == "A": Notify rep via Slack
    → If tier == "D": Add to nurture sequence
```

[HubSpot's own AI integration guide](https://blog.hubspot.com/sales/integrating-ai-with-existing-crm) acknowledges that **only 19% of sales teams use AI built directly into their CRM** — the majority still use external tools that break the workflow. A direct API integration eliminates that friction.

### Pattern 2: Meeting Booked → Auto-Prep Brief

When a meeting is created in Calendly (via webhook) or your calendar API, call `/sales/research` to get company intel, then `/sales/prep` to generate the talk track. Send the brief to your rep via Slack 30 minutes before the meeting starts.

```
Calendly "Meeting Created" webhook
    → POST /sales/research {company: prospect_company}
    → POST /sales/prep {company, contact, meeting_type: "discovery"}
    → POST to Slack: #{rep_channel} with structured brief
```

### Pattern 3: n8n or Zapier Integration

For no-code or low-code automation: add a custom HTTP action node in [n8n](https://n8n.io) or [Make](https://www.make.com) pointing to any Sales AI endpoint. Wire it between your lead source and your CRM. No server required.

Settings: `POST https://api.sales-ai.app/api/v1/sales/qualify`, Authorization header `Bearer YOUR_KEY`, JSON body mapping from your lead fields. The structured JSON response maps directly to CRM field names.

### Pattern 4: Async Batch Prospecting Overnight

Run `/sales/prospect` nightly via a cron job. Submit the job before midnight, configure a webhook to deliver results at completion. Your reps start each morning with a fresh, AI-researched prospect list with ICP scores — no manual prospecting required.

---

## Security: How API Keys Are Protected

<!-- ============================================================
IMAGE 9 — Security Architecture Breakdown
Image gen prompt: Dark security-themed infographic with 4 vertical pillars side by side. Pillar 1 (shield icon, label "AES-256-GCM Encryption"): text "Keys encrypted before database write. Plaintext exists in memory only during API call." Pillar 2 (database icon with lock, label "RLS Isolation"): "Every tenant table protected by Supabase row-level security policies." Pillar 3 (key icon with scope, label "Scoped API Keys"): "Mint keys limited to specific endpoints. Rotate without touching other integrations." Pillar 4 (scroll icon, label "Audit Logs"): "Key creation, rotation, and workspace changes logged with actor, timestamp, IP." Background: very dark navy with subtle circuit-board texture. Icon colour: electric blue. No people. 16:9.
Alt tag: Sales AI API security architecture showing four pillars: AES-256-GCM key encryption, Supabase row-level security isolation, scoped API keys per endpoint, and full audit logging
============================================================ -->

When you add your Anthropic API key to Sales AI, here is exactly what happens — step by step:

1. **Encryption at write time.** The key is encrypted with AES-256-GCM before it is written to the Supabase Postgres database. The plaintext key never touches the database. This is the same encryption standard used by financial-grade infrastructure — [AES-256-GCM is the NIST-recommended authenticated encryption algorithm](https://csrc.nist.gov/publications/detail/sp/800-38d/final) for protecting sensitive data at rest.

2. **Tenant isolation via RLS.** Every workspace operates behind Row-Level Security policies in Supabase Postgres. Your data is invisible to every other organisation at the database query level — not just the application layer. This architectural isolation is described in depth in [Supabase's own multi-tenancy documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

3. **In-memory-only decryption.** At call time, your Anthropic key is decrypted in memory, used for the single API call, and immediately discarded. Plaintext exists for milliseconds — never written to logs, never included in error messages, never visible in request tracing.

4. **Scoped workspace keys.** You can mint workspace API keys scoped to specific endpoints. Give your CRM integration a key that can only call `/sales/qualify`. Give your nightly batch job a key that can only call `/sales/prospect`. Rotate one without affecting the others.

5. **Audit trail.** Key creation, rotation, workspace changes, and permission updates are all logged with actor, timestamp, and IP address. Available in the workspace dashboard and exportable on the Enterprise plan.

[Full security documentation →](/security)

---

## Getting Started in 10 Minutes

Making your first sales AI API call takes under 10 minutes:

1. **Sign up** at [sales-ai-web-eta.vercel.app](/login) and create your first workspace
2. **Connect your Anthropic key** — Settings → API Keys → Add Anthropic Key
3. **Mint a workspace key** — Settings → Workspace Keys → Create Key
4. **Call `/sales/qualify`** with the cURL snippet from this article
5. **Get a score, tier, reasoning, and next action** back in your terminal in under 2 seconds

[Full quickstart →](/docs/quickstart) · [API Reference →](/docs/api-reference) · [Pricing →](/pricing)

---

## FAQ: Sales AI API

### What is a sales AI API?

A sales AI API is a REST interface that exposes structured AI capabilities for sales tasks — lead qualification, outreach writing, prospect research, objection handling, proposal generation, and more. Unlike a generic LLM API, a sales AI API returns typed JSON you can act on directly in code, without building prompt engineering infrastructure or parsing free-form text responses.

### How is a sales AI API different from calling OpenAI or Anthropic directly?

Calling OpenAI or Anthropic directly gives you a raw language model. A sales AI API gives you 15 purpose-built sales skills on top of that model — with structured input/output schemas, async job handling for long-running tasks, per-endpoint usage tracking, and multi-tenant key isolation. The [Anthropic API](https://platform.claude.com/docs/en/home) is excellent infrastructure; a sales AI API is the application layer that makes it production-usable for sales workflows in hours, not months.

### What endpoints does a sales AI API have?

Sales AI includes 15 endpoints covering the full sales cycle:

- **Prospecting:** `/sales/research`, `/sales/icp`, `/sales/competitors`, `/sales/prospect` (async), `/sales/contacts`
- **Outreach:** `/sales/outreach`, `/sales/followup`, `/sales/leads` (async), `/sales/quick`
- **Deal execution:** `/sales/qualify`, `/sales/prep`, `/sales/proposal`, `/sales/objections`
- **Reporting:** `/sales/report`, `/sales/report-pdf`

### How much does a sales AI API cost?

Sales AI charges a platform subscription for access to endpoints, workspace management, and usage tracking. LLM costs — your [Anthropic API token spend](https://platform.claude.com/docs/en/about-claude/pricing) — go directly to your Anthropic account. We have zero visibility into your token usage and charge nothing on top. [See platform pricing →](/pricing)

### Is a BYOK sales AI API secure?

Yes. Anthropic API keys are encrypted at rest with AES-256-GCM before database write. Keys are never logged, never exposed in API responses, and decrypted only in memory at call time. Every workspace is isolated by row-level security in Supabase Postgres — as documented in [Supabase's RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security). Scoped workspace keys let you limit which endpoints each integration can access. [Full security details →](/security)

### How do I add AI to my sales workflow with an API?

The most common pattern: (1) connect a CRM webhook when a lead is created or meeting is booked, (2) call the relevant Sales AI endpoint — `/sales/qualify` for lead scoring, `/sales/research` + `/sales/prep` for meeting prep, (3) write the structured JSON response back to your CRM or send it to your rep via Slack. The [quickstart guide](/docs/quickstart) walks through this in under 10 minutes.

### What languages does the sales AI API support?

Sales AI ships verified, production-ready code snippets for cURL, Python, TypeScript, JavaScript (Node.js), Go, PHP, and Ruby. The base API is standard REST over HTTPS with JSON bodies — any HTTP client in any language works.

### Can I use this to qualify leads in HubSpot or Salesforce?

Yes. Set up a HubSpot webhook on contact creation → call `POST /sales/qualify` with the lead data → write score, tier, and reasoning back to HubSpot custom properties. The structured JSON response maps directly to CRM field values with no additional parsing. [HubSpot's webhook documentation](https://developers.hubspot.com/docs/api/webhooks) covers the trigger setup; [our quickstart](/docs/quickstart) covers the API call and write-back pattern.

---

## Related Resources

- [API Reference — all 15 endpoints with full schemas →](/docs/api-reference)
- [Quickstart — zero to first API call in 10 minutes →](/docs/quickstart)
- [Security — AES-256-GCM key encryption and RLS isolation →](/security)
- [Pricing — platform tiers and BYOK policy →](/pricing)
- [Anthropic API Documentation](https://platform.claude.com/docs/en/home) — the LLM layer underneath Sales AI
- [HubSpot Webhook Docs](https://developers.hubspot.com/docs/api/webhooks) — trigger Sales AI from CRM events
- [Supabase RLS Guide](https://supabase.com/docs/guides/database/postgres/row-level-security) — the isolation model behind our security architecture
- [Stripe Webhook Best Practices](https://stripe.com/docs/webhooks) — the industry standard async delivery pattern Sales AI follows

---

<!-- ============================================================
SCHEMA MARKUP — paste into <script type="application/ld+json"> in your page <head>

{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "TechArticle",
      "headline": "Sales AI API: 15 Production-Ready Endpoints for Lead Qualification, Outreach, Prospecting & More",
      "description": "REST endpoints for qualifying leads, writing outreach, researching prospects and more. Full BYOK — your Anthropic key, your costs. See what you can build in 10 minutes.",
      "url": "https://sales-ai-web-eta.vercel.app/blog/sales-ai-api",
      "datePublished": "2026-04-20",
      "dateModified": "2026-04-20",
      "author": {"@type": "Organization", "name": "Sales AI", "url": "https://sales-ai-web-eta.vercel.app"},
      "publisher": {"@type": "Organization", "name": "Sales AI", "url": "https://sales-ai-web-eta.vercel.app"},
      "proficiencyLevel": "Intermediate",
      "dependencies": "Anthropic API key",
      "programmingLanguage": ["Python", "TypeScript", "JavaScript", "Go", "PHP", "Ruby", "cURL"]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {"@type": "Question", "name": "What is a sales AI API?", "acceptedAnswer": {"@type": "Answer", "text": "A sales AI API is a REST interface that exposes structured AI capabilities for sales tasks — lead qualification, outreach writing, prospect research, objection handling, and proposal generation. It returns typed JSON you can act on directly in code."}},
        {"@type": "Question", "name": "What endpoints does a sales AI API have?", "acceptedAnswer": {"@type": "Answer", "text": "Sales AI includes 15 endpoints: /sales/research, /sales/icp, /sales/competitors, /sales/prospect, /sales/contacts, /sales/outreach, /sales/followup, /sales/leads, /sales/quick, /sales/qualify, /sales/prep, /sales/proposal, /sales/objections, /sales/report, and /sales/report-pdf."}},
        {"@type": "Question", "name": "How much does a sales AI API cost?", "acceptedAnswer": {"@type": "Answer", "text": "Sales AI charges a platform subscription for endpoint access. LLM costs go directly to your Anthropic account — Sales AI charges nothing on top of token usage."}},
        {"@type": "Question", "name": "Is a BYOK sales AI API secure?", "acceptedAnswer": {"@type": "Answer", "text": "Yes. Keys are encrypted with AES-256-GCM at rest, decrypted only in memory during calls, and never logged. Workspaces are isolated by Supabase row-level security."}},
        {"@type": "Question", "name": "How do I add AI to my sales workflow with an API?", "acceptedAnswer": {"@type": "Answer", "text": "Connect a CRM webhook on lead creation or meeting booking, call the relevant Sales AI endpoint (e.g. /sales/qualify), and write the structured JSON response back to your CRM or send it to your rep via Slack."}}
      ]
    },
    {
      "@type": "HowTo",
      "name": "How to Make Your First Sales AI API Call",
      "totalTime": "PT10M",
      "step": [
        {"@type": "HowToStep", "name": "Sign up and create a workspace", "text": "Sign up at sales-ai-web-eta.vercel.app and create a workspace."},
        {"@type": "HowToStep", "name": "Connect your Anthropic key", "text": "Add your Anthropic API key under Settings → API Keys."},
        {"@type": "HowToStep", "name": "Mint a workspace key", "text": "Create a workspace API key under Settings → Workspace Keys."},
        {"@type": "HowToStep", "name": "Call /sales/qualify", "text": "POST to /api/v1/sales/qualify with your lead description in the JSON body."},
        {"@type": "HowToStep", "name": "Read the structured response", "text": "Get a score, tier, reasoning, and recommended next action back in structured JSON."}
      ]
    }
  ]
}
============================================================ -->
