# Build a Live Competitive Battle Card Generator With One API Call

<!-- ============================================================
SEO METADATA
Title tag (59 chars): Competitive Battle Card API: Generate Cards in One Call
Meta description (157 chars): Feed a competitor name and deal context to /sales/competitors. Get back strengths, weaknesses, your differentiators, and a ready-to-use battle card. Here's how to automate it.
Primary keyword: sales competitor battle card API
Secondary keywords: competitive battle card API, automate competitive intelligence API, battle card generator API, competitor analysis API
URL slug: /blog/sales-competitor-battle-card-api
Schema type: TechArticle + FAQPage
============================================================ -->

**Published:** April 2026 | **Reading time:** 8 min | **Audience:** Developers, RevOps engineers, sales enablement teams

---

<!-- ============================================================
FEATURED IMAGE
Image gen prompt: Dark-mode split-panel battle card illustration. LEFT PANEL (40%): a compact POST request terminal showing /sales/competitors endpoint with "competitor" and "deal_context" fields in green JSON. RIGHT PANEL (60%): a glowing battle card document floating on dark background. The card has four clearly labelled sections: "Their Strengths" (amber icons), "Their Weaknesses" (red icons), "Our Differentiators" (green checkmarks), "Talk Track" (blue speech bubble). Small timer badge: "2.4s". Background: deep charcoal. No people. 4K, 16:9.
Alt tag: Sales competitor battle card API showing POST request returning four-section battle card with strengths weaknesses differentiators and talk track in 2.4 seconds
============================================================ -->

---

> **The problem with Klue and Crayon:** They're excellent platforms — continuous monitoring, win-loss analysis, automated tracking. They're also $15,000–$50,000/year and designed for competitive intelligence teams, not a developer who needs a battle card generated when a rep mentions a competitor in a CRM note. Here's the API-level alternative.

---

## Table of Contents

1. [The Gap in Enterprise CI Tools](#the-gap-in-enterprise-ci)
2. [The API Call — Full Request and Response](#the-api-call)
3. [What Makes a Good Battle Card Context](#what-makes-good-context)
4. [Automating Battle Card Generation From CRM Notes](#automating-from-crm-notes)
5. [Storing Battle Cards Per Competitor](#storing-per-competitor)
6. [Serving Battle Cards to Reps on Demand](#serving-on-demand)
7. [FAQ: Sales Competitor Battle Card API](#faq)

---

## The Gap in Enterprise CI Tools

The top competitive intelligence platforms — Klue, Crayon, Highspot, Kompyte — share a design philosophy: continuous monitoring, a centralised intel library, version-controlled battle cards maintained by a product marketing or CI team. This works at scale for companies with a dedicated CI function.

For most developer-built sales stacks, the requirement is simpler: when a competitor is mentioned in a deal, generate a battle card for that competitor in the context of that deal. One call. Structured output. No $15,000/year platform required.

The `Battlecard.ai` approach starts to get there — *"generates battle cards, objection handlers, and competitive simulations for any competitor in 60 seconds"* — but it's still a SaaS dashboard, not an API.

`/sales/competitors` is the API layer: POST a competitor name and deal context, receive a structured battle card in typed JSON, store or serve it however your stack already works.

---

## The API Call — Full Request and Response

**Request:**
```bash
curl -X POST https://api.sales-ai.app/api/v1/sales/competitors \
  -H "Authorization: Bearer $WORKSPACE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "competitor": "Apollo.io",
    "deal_context": "Deal with DataFlow Inc — VP RevOps evaluating sales enrichment and AI tooling. Currently uses Apollo for data. Looking to add AI qualification and outreach automation. Budget: Series B, $15M raised.",
    "your_product": "Sales AI BYOK API — 15 endpoints for qualification, research, outreach. No per-seat fees. Bring your own Anthropic key."
  }'
```

**Response (2.4 seconds):**
```json
{
  "status": "success",
  "data": {
    "competitor": "Apollo.io",
    "their_strengths": [
      "275M+ contact database — the largest proprietary B2B contact dataset",
      "All-in-one platform: find → email → sequence in one UI",
      "Strong brand recognition with 10,000+ G2 reviews",
      "Free tier with generous email credits"
    ],
    "their_weaknesses": [
      "API access requires $5,000+/year custom plan",
      "AI features (email generation) are basic and vendor-billed — no BYOK",
      "Per-seat pricing becomes expensive at scale",
      "No structured AI reasoning layer — scores in the UI, not via API"
    ],
    "our_differentiators": [
      "REST API from day one — no UI required, integrate into any stack",
      "BYOK — LLM costs go to customer's Anthropic account, zero markup",
      "Typed structured output — score, tier, reasoning, next action in JSON",
      "15 purpose-built endpoints vs Apollo's database-first model"
    ],
    "talk_track": "Apollo is excellent for contact data — and many of our customers use both. Where we fit is the AI reasoning layer Apollo doesn't have: when a contact comes in, /sales/qualify scores them against your ICP with reasoning, /sales/research synthesises company context, and /sales/outreach generates personalised copy. All via REST. All BYOK. Apollo tells you who exists; we tell you what to do about them.",
    "objection_handlers": [
      {
        "objection": "We already have Apollo",
        "response": "Great — Apollo and Sales AI are complementary. Use Apollo's database to find leads. Use our API to qualify them, research them, and generate outreach automatically. Your reps get both the contact data and the AI intelligence layer."
      },
      {
        "objection": "Apollo has AI features",
        "response": "Apollo's AI email generation is bundled into their UI and vendor-billed. There's no API access, no structured output, and no BYOK. If you want to call AI qualification from code, write the result to your CRM, and route leads programmatically — Apollo can't do that."
      }
    ]
  },
  "meta": {
    "model": "claude-sonnet-4-20250514",
    "tokens_used": 892,
    "duration_ms": 2420
  }
}
```

Every section is typed JSON you can render in a Slack message, a CRM note, a deal sidebar widget, or a rep-facing web app.

<!-- ============================================================
IMAGE 1 — Battle card output four-section annotated
Image gen prompt: Dark-mode four-quadrant battle card card. Each quadrant has a coloured header bar. TOP-LEFT "Their Strengths" (amber): 4 bullet points with magnifier icons. TOP-RIGHT "Their Weaknesses" (red): 4 bullet points with X icons. BOTTOM-LEFT "Our Differentiators" (green): 4 bullet points with checkmark icons. BOTTOM-RIGHT "Talk Track" (electric blue): 3-sentence paragraph with speech bubble icon. A small badge: "Generated by /sales/competitors — 2.4s". Clean dark card on charcoal background. No people. 16:9.
Alt tag: Sales competitor battle card API output showing four sections strengths weaknesses differentiators talk track and objection handlers generated from one POST request
============================================================ -->

---

## What Makes a Good Battle Card Context

The depth of the battle card scales with the detail in the `deal_context` field.

**Minimal context (generic battle card):**
```json
{
  "competitor": "Apollo.io",
  "deal_context": "B2B SaaS deal",
  "your_product": "Sales AI API"
}
```
Output: general strengths/weaknesses relevant to Apollo vs any sales tool. Usable but not deal-specific.

**Rich context (deal-specific battle card):**
```json
{
  "competitor": "Apollo.io",
  "deal_context": "VP RevOps at Series B SaaS, 180 employees. Currently using Apollo for contact data. Evaluating adding AI qualification and outreach automation. Pain: SDRs spending 2hrs/day on manual research. Budget approved. Decision by end of month.",
  "your_product": "Sales AI BYOK API — REST endpoints for qualification, research, outreach. No per-seat fees. Bring your own Anthropic key."
}
```
Output: talk track references their current Apollo usage, objection handlers address "we already have Apollo", differentiators focus on the API vs UI distinction the VP RevOps cares about.

**What to include in `deal_context`:**
- The prospect's current tool (if known)
- Why they're evaluating alternatives
- Their specific pain point
- Budget signal or urgency
- Role of the decision-maker

---

## Automating Battle Card Generation From CRM Notes

The most powerful trigger: generate a battle card automatically whenever a rep logs a competitor name in a CRM deal note.

```python
import re
import requests

# Competitor names to watch for in CRM notes
KNOWN_COMPETITORS = [
    "Apollo", "Apollo.io", "ZoomInfo", "Clay", "Seamless", "Lusha",
    "Klue", "Crayon", "Outreach", "SalesLoft", "Salesloft"
]

def extract_competitor_from_note(note_text: str) -> str | None:
    """Extract a known competitor name from a CRM note."""
    for competitor in KNOWN_COMPETITORS:
        if re.search(re.escape(competitor), note_text, re.IGNORECASE):
            return competitor
    return None

def generate_battle_card_from_note(deal_id: str, note_text: str, workspace_key: str) -> dict | None:
    """
    If a CRM note mentions a competitor, generate a battle card.
    Returns None if no competitor detected.
    """
    competitor = extract_competitor_from_note(note_text)
    if not competitor:
        return None
    
    # Fetch deal context from CRM
    deal_props = get_deal_properties(deal_id)  # your HubSpot/Pipedrive fetch function
    
    deal_context = f"""
    {deal_props.get('dealname', 'B2B deal')}.
    Stage: {deal_props.get('dealstage', 'unknown')}.
    Amount: ${deal_props.get('amount', 'TBD')}.
    {note_text}
    """.strip()
    
    result = requests.post(
        "https://api.sales-ai.app/api/v1/sales/competitors",
        headers={"Authorization": f"Bearer {workspace_key}"},
        json={
            "competitor": competitor,
            "deal_context": deal_context,
            "your_product": "Sales AI BYOK API — 15 endpoints for sales automation, no per-seat fees, BYOK"
        }
    ).json()["data"]
    
    print(f"Battle card generated for {competitor} on deal {deal_id}")
    return result

# HubSpot engagement webhook → parse notes for competitor mentions
def on_hubspot_note_created(note_id: str, note_body: str, associated_deal_id: str):
    card = generate_battle_card_from_note(associated_deal_id, note_body, WORKSPACE_KEY)
    if card:
        # Post battle card back to the deal as a formatted note
        create_deal_note(associated_deal_id, format_battle_card_as_note(card))
        # Or send to rep via Slack
        send_to_slack_rep(associated_deal_id, card)
```

---

## Storing Battle Cards Per Competitor

For competitors you face frequently, cache battle cards so you're not regenerating from scratch on every deal:

```python
import sqlite3
import json
import time

class BattleCardCache:
    """
    Simple SQLite cache for competitor battle cards.
    Refreshes cards older than 7 days.
    """
    
    def __init__(self, db_path: str = "battle_cards.db"):
        self.conn = sqlite3.connect(db_path)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS battle_cards (
                competitor TEXT PRIMARY KEY,
                card_json  TEXT NOT NULL,
                created_at REAL NOT NULL
            )
        """)
        self.conn.commit()
    
    def get(self, competitor: str, max_age_days: int = 7) -> dict | None:
        row = self.conn.execute(
            "SELECT card_json, created_at FROM battle_cards WHERE competitor = ?",
            (competitor.lower(),)
        ).fetchone()
        
        if not row:
            return None
        
        age_days = (time.time() - row[1]) / 86400
        if age_days > max_age_days:
            return None  # Stale — regenerate
        
        return json.loads(row[0])
    
    def store(self, competitor: str, card: dict):
        self.conn.execute(
            "INSERT OR REPLACE INTO battle_cards VALUES (?, ?, ?)",
            (competitor.lower(), json.dumps(card), time.time())
        )
        self.conn.commit()

cache = BattleCardCache()

def get_or_generate_battle_card(competitor: str, deal_context: str, workspace_key: str) -> dict:
    """Return cached card if fresh, generate new one if stale."""
    
    # Try cache first (generic card for this competitor)
    cached = cache.get(competitor)
    
    if cached and not deal_context:
        return cached  # Use cached generic card
    
    # Generate deal-specific card (always fresh)
    result = requests.post(
        "https://api.sales-ai.app/api/v1/sales/competitors",
        headers={"Authorization": f"Bearer {workspace_key}"},
        json={
            "competitor": competitor,
            "deal_context": deal_context or f"General competitive analysis vs {competitor}",
            "your_product": "Sales AI BYOK API"
        }
    ).json()["data"]
    
    # Cache the generic version (no deal context)
    if not deal_context:
        cache.store(competitor, result)
    
    return result
```

---

## Serving Battle Cards to Reps on Demand

Build a simple internal endpoint that reps (or Slack bots) can call to get a battle card for any competitor:

```python
@app.get("/battle-cards/{competitor}")
async def get_battle_card(competitor: str, deal_id: str | None = None):
    """
    Internal endpoint: GET /battle-cards/apollo?deal_id=123
    Returns battle card for the competitor, optionally deal-specific.
    """
    deal_context = ""
    if deal_id:
        deal = get_deal_properties(deal_id)
        deal_context = f"{deal.get('dealname', '')}, {deal.get('dealstage', '')}, ${deal.get('amount', 'TBD')}"
    
    card = get_or_generate_battle_card(competitor, deal_context, WORKSPACE_KEY)
    return card

# Slack slash command: /battlecard apollo deal_123
# → fetches from your server → returns formatted Slack message
```

[See the full /sales/competitors schema →](/docs/api-reference) · [Start the quickstart →](/docs/quickstart)

---

## FAQ: Sales Competitor Battle Card API

### How do I automate competitive intelligence?

Call `POST /api/v1/sales/competitors` with the competitor name, deal context, and a brief product description. You get back a structured JSON object with their strengths, weaknesses, your differentiators, a talk track, and objection handlers. Automate it by monitoring CRM notes for competitor mentions, triggering the call when a competitor is detected, and posting the result as a deal note or Slack message to the rep.

### What is a sales battle card?

A battle card is a structured document that helps sales reps understand how to position against a specific competitor in a live deal. It typically includes: (1) the competitor's strengths, (2) their weaknesses, (3) your differentiators that counter their strengths, (4) a talk track the rep can use when asked "how are you different from X?", and (5) objection handlers for common competitor-related objections.

### Can AI generate competitive analysis?

Yes. The `/sales/competitors` endpoint uses Claude Sonnet to generate a full competitive battle card from a competitor name and deal context. The more context you provide — current tools, specific pain points, deal stage, decision-maker role — the more deal-specific the output. Generic battle cards are useful for rep training; deal-specific cards are more persuasive in live conversations.

### How do I track competitors in my CRM?

The pattern: (1) Subscribe to note/engagement creation events via your CRM's webhook API. (2) Parse note text for known competitor names using regex. (3) When a match is found, call `/sales/competitors` with the competitor name and deal context. (4) Write the battle card back to the deal as a note, or send it to the rep's Slack. Over time, build a cache of frequently-encountered competitors so cards are available immediately when needed.

### What data does competitive analysis need?

At minimum: competitor name and your product description. The quality improves with: the prospect's current tool usage (are they already a customer?), why they're evaluating alternatives, the deal stage and urgency, and the decision-maker's role and priorities. The `deal_context` field accepts a free-form string — include whatever is in your CRM notes about the deal.

---

## Related Resources

- [Sales AI API Reference — /sales/competitors →](/docs/api-reference)
- [Sales AI Product — all 15 endpoints →](/product)
- [Clay Apollo Alternative for Developers →](/blog/clay-apollo-alternative-developers)
- [Complete AI Sales Pipeline →](/blog/add-ai-to-sales-workflow)
- [Sales AI Quickstart →](/docs/quickstart)
- [Klue: Battle Cards 101](https://klue.com/blog/competitive-battlecards-101)
- [Battlecard.ai — AI competitive intelligence platform](https://battlecard.northr.ai/)
