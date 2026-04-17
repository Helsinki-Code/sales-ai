# Lead Generation Engine

## Metadata

- **Title:** Lead Generation Engine
- **Invocation:** `/sales leads <url> <count>`
- **Input:** Seller website URL and target number of leads to generate (integer: 5–100)
- **Output:** `leads-<company>-<YYYY-MM-DD>.csv` written to the current working directory

---

## Purpose

You are the lead generation engine for `/sales leads <url> <count>`. You generate a list of N **real, verified leads** (companies + decision-maker contacts) that match a seller's ideal customer profile (ICP).

The workflow:
1. Analyze the seller's own website to understand what they sell and who they target
2. Generate a tailored ICP (or read an existing one) with 6 key dimensions
3. Execute targeted searches to find N companies matching the ICP
4. Enrich each company with real-time firmographics, funding, tech stack, and hiring signals
5. Identify the primary decision-maker contact at each company
6. Score each lead 0–100 based on ICP fit + 4 buying signals
7. Export a **CSV file** with 20 columns: company data, contact details, ICP scores, and outreach-ready messaging

**Critical constraint:** All leads are found via real WebFetch and WebSearch calls to public sources. No mocking, no simulated data, no databases. Every contact email, company size, and signal is verified.

---

## When This Skill Is Invoked

- **Standalone:** The user runs `/sales leads <url> <count>`. Perform the full 7-phase procedure and output the CSV to the current working directory.
- **Not designed as subagent:** This skill always runs standalone in a single session.

---

## Phase 1: Seller Website Analysis (Understanding the Seller)

Analyze the seller's own website to extract critical intelligence that will shape the ICP and lead search strategy.

### 1.1 Fetch and Analyze 6 Key Pages

Use WebFetch to retrieve these pages in priority order. Skip any that are unreachable after 2 attempts:

| Page | URLs to try | Priority data |
|------|-------------|---------------|
| **Homepage** | `/` | Company/product name, tagline, value prop, primary problem statement, target audience language |
| **About** | `/about`, `/about-us`, `/company`, `/team` | Company stage (startup/growth/scale), team size, mission, founding story, geography |
| **Product** | `/product`, `/features`, `/solutions`, `/platform`, `/how-it-works` | Product/service description, feature list, use cases, integrations, API/platform language |
| **Pricing** | `/pricing`, `/plans`, `/packages`, `/pricing-plans` | Pricing tier names, price points, segment language ("SMB", "enterprise", etc.), deal size signals |
| **Customers** | `/customers`, `/case-studies`, `/clients`, `/testimonials`, `/success-stories` | Customer names/logos, industry breakdown, company sizes served, featured results/ROI |
| **Blog/Resources** | `/blog`, `/resources`, `/insights`, `/articles` | Content topics, problem domain vocabulary, audience signals, thought leadership quality |

### 1.2 Seller Intelligence Extraction

From the 6 pages above, extract these 8 fields into working memory (used in Phase 2):

| Field | What to extract | Example |
|-------|-----------------|---------|
| `seller_product` | One-sentence product/service name and function | "AI-powered lead generation platform for founders" |
| `seller_problem` | The core problem being solved | "Sales teams waste 8-12 hours per week researching prospects" |
| `seller_target_persona` | Job titles and audience language found on the site | "VP of Sales, Sales Ops Manager, Founder, Agency Owner" |
| `seller_industries` | Any industries mentioned in customers or positioning | "SaaS, Fintech, MarTech, Staffing, B2B Services" |
| `seller_company_sizes` | Size language from positioning or customers | "Startups, SMB (5-100 employees), Mid-market (100-1000), Enterprise (1000+)" |
| `seller_tech_keywords` | Technologies, integrations, platforms mentioned | "Salesforce, HubSpot, LinkedIn, Gmail, Slack, Zapier, API-first, webhooks" |
| `seller_price_tier` | Price range from pricing page if visible | "$99-500/month per user OR contact sales OR free tier + enterprise" |
| `seller_social_proof` | Specific customer logos, names, or case study results mentioned | "Used by Acme Corp, Tech Startup X, Growing Agency Y" |

### 1.3 Quality Gate

- **Pass:** At least 3 of the 6 pages fetched successfully; all 8 fields populated (even if some are "Unknown")
- **Fail:** Fewer than 2 pages fetched; cannot determine seller's product. Report error and exit.

---

## Phase 2: ICP Generation (Derive Ideal Customer Profile)

### 2.1 Check for Existing ICP

Before generating, check if `IDEAL-CUSTOMER-PROFILE.md` exists in the current working directory.

- **If exists:** Read it, skip to Phase 3. Use existing ICP as ground truth.
- **If not exists:** Proceed to Phase 2.2.

### 2.2 Generate ICP via Web Research

Execute 5 targeted WebSearch queries to synthesize an ICP tailored to the seller:

```
Search 1: "[seller_product category from Phase 1] ideal customer profile ICP"
Search 2: "[seller_product] target market company size revenue ARR"
Search 3: "[seller_product] buyers decision makers job titles"
Search 4: "[seller_product] best industries vertical market fit"
Search 5: "[seller company name if known] customers case studies who uses [product]"
```

From Phase 1 data + search results, synthesize these 6 ICP dimensions:

| ICP Dimension | What to capture | Example output |
|---------------|-----------------|-----------------|
| **Target Industries** | 3–5 primary verticals ranked by fit | `["SaaS / Software", "Fintech", "B2B Services"]` |
| **Company Size Range** | Employee count and revenue ranges | `"employees: 50–500, revenue: $5M–$50M ARR"` |
| **Target Geography** | Regions/countries where demand is highest | `["USA", "Canada", "UK", "EU"]` |
| **Decision Maker Titles** | 3–5 exact job title patterns | `["VP of Sales", "Head of Growth", "Founder", "Chief Revenue Officer", "VP of Operations"]` |
| **Tech Stack Signals** | 3–6 complementary tools that indicate fit | `["Salesforce", "HubSpot", "Segment", "LinkedIn", "Outreach"]` |
| **Buying Signal Profile** | What stage/event indicates readiness | `"Series A–C companies, 20–100 person teams, active hiring in sales/ops"` |

### 2.3 Quality Gate

- **Pass:** All 6 dimensions populated (even partially); ICP is coherent and actionable
- **Fail:** More than 3 dimensions are "Unknown". Report data gap and either proceed with low confidence or exit and suggest refining with `/sales icp <description>`

---

## Phase 3: Lead Discovery (Find Matching Companies at Scale)

Execute a **matrix of WebSearch queries** across 4 complementary search strategies to find companies matching the ICP. Each strategy returns different candidates.

### 3.1 Strategy A — Industry + Size Searches (3–5 queries)

```
Query 1: "[ICP primary industry] companies [ICP size] employees [ICP geography]"
Query 2: "top [ICP industry] [company type] companies [current year]"
Query 3: "[ICP industry] startups [ICP stage] [ICP geography] [current year]"
Query 4: "list of [ICP industry] companies [ICP geography]"
Query 5: "[ICP industry] software platforms [ICP size] companies"
```

Expected: Company names, websites, initial size/industry signals from Google results.

### 3.2 Strategy B — Technology Signal Searches (2–3 queries)

```
Query 1: "companies using [tech signal 1] [ICP industry]"
Query 2: "[competitor product / adjacent tool] customers [ICP industry]"
Query 3: "[tech stack keyword] users [ICP industry] companies"
```

Expected: Companies that use tools similar to the seller's or tools complementary to the seller's.

### 3.3 Strategy C — Funding/Growth Signal Searches (2–3 queries)

```
Query 1: "[ICP industry] companies raised funding [current year or last 2 years]"
Query 2: "[ICP industry] startups [ICP geography] [year] [round name: Series A, B, C]"
Query 3: "[ICP industry] company expansion hiring [current year]"
```

Expected: Recently funded companies, companies in active growth phase.

### 3.4 Strategy D — Job Posting Signal Searches (2–3 queries)

```
Query 1: "[ICP decision maker title 1] [ICP industry] companies hiring [ICP geography]"
Query 2: "[relevant function: Sales, Operations] job posting [ICP industry] company"
Query 3: "[ICP industry] company hiring [primary department] team [current year]"
```

Expected: Companies actively hiring (signal of budget and growth).

### 3.5 Candidate Collection and Deduplication

- Execute all 10–14 searches above
- From each search result, extract company names and websites
- Collect until you have at least `count × 2.5` unique candidates (if targeting 30 leads, aim for 75+ candidates)
- **Deduplicate by normalized domain:** Strip protocol, www, convert to lowercase, remove trailing slash. Only keep unique domains.
- If fewer than `count` candidates found after deduplication, note the shortfall and proceed (quality over quantity)

### 3.6 Quality Gate

- **Pass:** At least `count` unique companies identified
- **Fail (proceed anyway):** Fewer than `count` companies found. Log the shortfall, proceed with what was found, note in terminal output

---

## Phase 4: Company Enrichment (Firmographics for Each Candidate)

For each unique company found in Phase 3, gather real firmographic data. Process companies in sequential order.

### 4.1 Per-Company Enrichment Process

For **each company**, execute this sequence:

1. **WebFetch the company homepage** — Extract from meta tags, H1, description:
   - Industry classification (technology, finance, healthcare, etc.)
   - Size signals (employees, headcount language)
   - Location (headquarters, office)
   - Description (from `<meta name="description">`)
   - Any tech stack language (integrations, API references)

2. **WebSearch for funding + company data** — Execute 1–2 searches per company:
   ```
   Search: "[company name] funding Crunchbase OR employees OR revenue"
   Search: "[company name]" company profile LinkedIn
   ```
   Extract:
   - Total funding raised (if disclosed)
   - Funding stage (Seed, Series A, B, C, etc.)
   - Date of last funding round
   - Employee count (from LinkedIn or search)
   - Headquarters location (city, state/country)

3. **Extract and store** these 10 fields per company:
   - `company_name` (string)
   - `company_website` (full URL)
   - `company_industry` (string, e.g. "SaaS / CRM")
   - `company_size_employees` (integer or string range, e.g. "45–75" or "approximately 50")
   - `company_location` (city, state/country)
   - `company_funding_total` (string, e.g. "$4.2M" or "Bootstrapped" or "Unknown")
   - `company_funding_recent_date` (string, e.g. "Q1 2025" or "Unknown")
   - `company_linkedin` (URL if found, else empty)
   - `company_description` (1-line summary from meta description or About page)
   - **4 Signal Flags** (boolean, set during this phase or Phase 5):
     - `recent_funding_flag` — True if funded in last 6–12 months
     - `recent_hiring_flag` — True if active job postings detected (Phase 5)
     - `tech_stack_match_flag` — True if complementary tech tools are detected
     - `growth_signal_flag` — True if any of: headcount growth, new office, new product launch, market expansion

### 4.2 Tech Stack Matching

While enriching, look for signals that the company uses **complementary tools** to what the seller offers:
- Check the company's careers page for job posting tech requirements
- Check for integration mentions on the company's website
- Apply keyword matching: if ICP lists "Salesforce, HubSpot" and company's job post mentions these tools, `tech_stack_match_flag = True`

### 4.3 Funding Signal Detection

- `recent_funding_flag = True` if funding date is within 6–12 months of today
- If funding date is 12–24 months ago, flag as "older funding"; if 24+ months, no flag

### 4.4 Quality Gate

- **Pass:** Each company has at minimum: `company_name`, `company_website`, `company_industry`. Size/funding can be "Unknown".
- **Fail (skip company):** Company website is 403/429 or completely unreachable after 2 WebFetch attempts. Use only search-derived data for that company and mark all confidence as `low`

---

## Phase 5: Contact Finding (Decision Maker per Company)

For each enriched company, find the **primary decision-maker contact** using layered search approaches.

### 5.1 Layered Contact Discovery

For each company, attempt discovery in this order:

#### Layer 1 — LinkedIn Search
```
Search: "[company name] [ICP decision maker title 1] LinkedIn"
Example: "Acme Corp VP of Sales LinkedIn" or "Acme Corp CEO founder LinkedIn"
```
From the search result snippet, extract:
- Contact name (if visible in snippet)
- LinkedIn profile URL
- Job title (from snippet or profile if accessible)

#### Layer 2 — Company Website Team/About Pages
WebFetch these pages in priority order: `/team`, `/leadership`, `/about`, `/management`, `/people`

Look for:
- Names and titles in page text or card markup
- Email patterns in `mailto:` links or visible text
- LinkedIn profile URLs linked from team cards

#### Layer 3 — Email Pattern Derivation
If you find example emails on the company website (e.g., from customer support or footer), derive the email format:
- Example: `sarah.chen@acme.com` → pattern: `firstname.lastname@domain`
- Apply this pattern to the decision maker's name:
  - Contact: "John Smith" + pattern → `john.smith@acme.com`
  - Mark as `email_confidence = "pattern_derived"`

#### Layer 4 — Direct Search for Contact Email
```
Search: "[company name] [contact name] email"
```
Look for emails in LinkedIn summary, company bio, or public directory listing.

### 5.2 Decision Maker Title Prioritization

When multiple potential contacts are found, prioritize titles in **ICP order**:
1. First match ICP decision-maker title 1 (e.g., "VP of Sales")
2. Then ICP title 2 (e.g., "Head of Growth")
3. Then founder/CEO if no match
4. Accept the highest-priority match found

### 5.3 Contact Fields to Capture

For the selected contact, capture these 6 fields:

| Field | What to capture | Email confidence levels |
|-------|-----------------|-------------------------|
| `contact_name` | Full name as displayed | N/A |
| `contact_title` | Job title (exact or inferred) | N/A |
| `contact_email` | Email address (string) or empty | `confirmed`, `pattern_derived`, `unknown` |
| `contact_linkedin` | LinkedIn profile URL or empty | N/A |
| `contact_phone` | Phone number if found; usually empty | N/A |
| `email_confidence` | See column 3 | N/A |

### 5.4 Email Confidence Levels

- **`confirmed`:** Email found in a public LinkedIn profile or official company directory, or verified by WHOIS/reverse lookup
- **`pattern_derived`:** Email constructed from a pattern detected on the website (firstname.lastname@domain) applied to the contact's name
- **`unknown`:** No email found; contact_email left blank

### 5.5 Fallback for Missing Contacts

If no contact can be found for a company after all 4 layers:
- `contact_name = "Unknown"`
- `contact_title = "Unknown"`
- `contact_email = ""` (empty)
- `contact_linkedin = ""`
- `email_confidence = "unknown"`

The company is still included in the final CSV with blank contact fields.

### 5.6 Quality Gate

- **Pass:** Contact found for 70%+ of companies (optional, proceed regardless)
- **Note:** Contact coverage percentage is calculated and printed in terminal output

---

## Phase 6: Lead Scoring (ICP Fit + 4 Buying Signals)

Score each lead on a 0–100 composite scale across **5 dimensions**, each with explicit point ranges and rubrics.

### 6.1 The 5 Scoring Dimensions

| Dimension | Max Points | What it measures | Notes |
|-----------|-----------|------------------|-------|
| **ICP Firmographic Fit** | 35 | Industry, company size, geography, stage vs. ICP | Highest weight |
| **Hiring Signal** | 20 | Active job postings for relevant roles | Confidence of spend readiness |
| **Recent Funding** | 15 | Raised capital in last 6–12 months | Budget signal |
| **Tech Stack Match** | 15 | Uses complementary or adjacent tools | Fit for integration/value-add |
| **Growth Signal** | 15 | Headcount growth, new office, product launch, market expansion | Momentum / pain acuity |
| **TOTAL** | **100** | Composite score | Grade bands follow |

### 6.2 ICP Firmographic Fit (0–35 points)

Score based on match against the 6 ICP dimensions from Phase 2:

**Industry Match (0–15 points):**
- Primary industry match (exact): 15 points
- Adjacent industry match (e.g., "SaaS" matches "Tech SaaS"): 9 points
- Secondary industry match (tangentially related): 5 points
- No industry match: 0 points

**Company Size Match (0–10 points):**
- Within ICP size range (e.g., ICP 50–500 employees, company is 75): 10 points
- Within 50% of ICP range: 6 points
- Far outside ICP range: 0 points

**Geography Match (0–5 points):**
- Country matches ICP geography: 5 points
- Adjacent/friendly country: 3 points
- Outside ICP geography: 0 points

**Stage Match (0–5 points):**
- Funding stage matches ICP (e.g., ICP "Series A–C", company "Series B"): 5 points
- Adjacent stage (e.g., ICP "Series B", company "Series A or C"): 3 points
- Far from ICP stage: 0 points

**Subtotal for ICP Fit: Sum of four sub-scores (max 35)**

### 6.3 Hiring Signal (0–20 points)

Based on evidence of active job postings in roles relevant to the ICP:

- **5+ active job postings for relevant roles** (e.g., Sales, Operations, Engineering if ICP targets those teams): 20 points
- **2–4 relevant open roles**: 14 points
- **Hiring exists but roles are generic or unspecific**: 8 points
- **No hiring signals found (no careers page, no open roles)**: 0 points

"Relevant roles" = roles that suggest the company is investing in the department your product serves. For a sales tool, "VP of Sales", "Sales Engineer", "Account Executive" are relevant.

### 6.4 Recent Funding (0–15 points)

Based on funding timing and size signals:

- **Funded within last 0–6 months** (very recent, high cash influx): 15 points
- **Funded 6–12 months ago** (recent, capital still flowing): 10 points
- **Funded 12–24 months ago** (older but still relevant): 5 points
- **Funded 24+ months ago OR bootstrapped OR no funding detected**: 0 points

### 6.5 Tech Stack Match (0–15 points)

Based on overlap between company's tech stack and ICP tech stack signals:

- **2+ complementary tools detected** (e.g., company uses Salesforce AND HubSpot, both in ICP): 15 points
- **1 complementary tool detected**: 10 points
- **Adjacent/tangential tools** (not direct match but related): 5 points
- **No overlap**: 0 points

Match criteria: Compare company's job posting requirements or public integrations against ICP `tech_stack_signals` list.

### 6.6 Growth Signal (0–15 points)

Based on evidence of company momentum and expansion:

- **2+ growth signals present** (e.g., headcount growth + new office + new product): 15 points
- **1 strong signal** (recent funding alone, or hiring surge, or major new market entry): 10 points
- **1 mild signal** (minor expansion, slow headcount growth, blog activity): 5 points
- **No growth signals**: 0 points

Growth signals include:
- Headcount growth of 10%+ in 6 months (compare current employees to public hiring announcements)
- New office location opening
- New product/feature launch
- Entry into new market or geographic region
- Recent funding round (if not already scored in Recent Funding dimension)

### 6.7 Grade Assignment

After calculating composite score (0–100), assign grade:

```
80–100:  Grade A   (Hot lead — pursue immediately, high close probability)
60–79:   Grade B   (Strong lead — worth significant investment)
40–59:   Grade C   (Warm lead — nurture and monitor, revisit in 6 months)
0–39:    Grade D   (Cold lead — low priority or disqualify)
```

### 6.8 Matched Signals Field

Create a comma-separated string of which buying signals fired (non-zero points):

Example: `"recent_funding, hiring_relevant_roles, tech_stack_match, growth_signal"`

Only include signals that scored > 0 points.

### 6.9 Qualification Reason

Generate a 1–2 sentence human-readable explanation of the score:

Example: "Series B fintech company (185 employees) actively hiring VP of Operations and Sales team. Recent $12M funding (Q1 2025), uses Salesforce + HubSpot (complementary stack). Strong ICP fit with multiple growth signals."

Components to include:
- Company stage + size
- Relevant hiring activity (if present)
- Funding timing (if present)
- Tech stack overlap (if present)
- Overall assessment ("Strong ICP fit", "Good growth signal", "Cold lead due to mismatched industry")

### 6.10 Quality Gate

- **Pass:** All leads scored; scores are between 0–100
- **Fail:** More than 20% of leads are Grade D. This indicates ICP mismatch. Suggest user refine ICP with `/sales icp <description>` and try again

---

## Phase 7: CSV Export (Output Generation)

Assemble all lead data and write a CSV file to the current working directory.

### 7.1 CSV File Name

Format: `leads-<seller-company-slug>-<YYYY-MM-DD>.csv`

Examples:
- `leads-vranceflex-2026-04-17.csv`
- `leads-acme-corp-2026-04-17.csv` (domain name slugified)

Extract company slug from the seller's website URL domain (e.g., vranceflex.online → vranceflex).

### 7.2 CSV Generation Method

Use Python script to generate the CSV:

1. Collect all scored leads (from Phase 6) as a JSON array
2. Call `/scripts/generate_leads_csv.py` with `--output leads-<slug>-<date>.csv`
3. Pass leads JSON via stdin or JSON file
4. Script writes CSV sorted descending by `icp_score`, returns summary JSON to stdout

**Fallback:** If Python is unavailable, write CSV directly using Claude's file tools with proper CSV escaping.

### 7.3 CSV Column Specification (20 columns)

Order is important; this is the output column sequence:

#### Company Info (7 columns)
```
company_name
company_website
company_industry
company_size
company_location
company_funding
company_linkedin
```

#### Contact Details (6 columns)
```
contact_name
contact_title
contact_email
contact_linkedin
contact_phone
email_confidence
```

#### ICP Scoring (4 columns)
```
icp_score
icp_grade
matched_signals
qualification_reason
```

#### Outreach Ready (3 columns)
```
personalization_hook
suggested_subject
best_channel
```

### 7.4 Column Data Types & Rules

**String columns:** All strings. Double-quote all fields in CSV to handle commas/newlines.

**Numeric columns:** `icp_score` is an integer (0–100). No currency symbols or formatting.

**URL columns:** Full URLs (including `https://`), or empty string if not found.

**Email columns:** Email address (lowercase) or empty string if confidence is `unknown`.

**Enum columns:** 
- `icp_grade`: One of `A`, `B`, `C`, `D`
- `email_confidence`: One of `confirmed`, `pattern_derived`, `unknown`
- `best_channel`: One of `email`, `linkedin`, `both`, `phone`

**Blank handling:** Empty cells are completely empty (not "Unknown", not "N/A") **except**:
- `contact_name = "Unknown"` if no contact found
- `contact_email = ""` (empty) if not found

### 7.5 Sort Order

Leads are sorted **descending by `icp_score`** (Grade A leads first, Grade D last). This ensures top prospects appear at the top of the CSV.

### 7.6 CSV Formatting Rules

- **Encoding:** UTF-8, no BOM
- **Delimiter:** Comma (`,`)
- **Quotes:** Double-quote (`"`) all string fields; CSV writer handles escaping
- **Header row:** Row 1 contains exact column names from section 7.3
- **Data rows:** One lead per row; no blank rows
- **Line endings:** Platform-default (CRLF on Windows, LF on Unix)

---

## Output Format: The CSV File

The final output is a CSV file with this structure:

```csv
company_name,company_website,company_industry,company_size,company_location,company_funding,company_linkedin,contact_name,contact_title,contact_email,contact_linkedin,contact_phone,email_confidence,icp_score,icp_grade,matched_signals,qualification_reason,personalization_hook,suggested_subject,best_channel
"Acme Corp","https://acmecorp.com","SaaS / CRM","185 employees","San Francisco, CA, USA","$12M Series B (Q1 2025)","https://linkedin.com/company/acmecorp/","Sarah Chen","VP of Operations","sarah.chen@acmecorp.com","https://linkedin.com/in/sarahchen","","pattern_derived",82,"A","recent_funding, hiring_relevant_roles, tech_stack_match, growth_signal","Series B SaaS company scaling ops team. Raised $12M in Q1 2025, actively hiring, uses complementary stack.","Raised $12M Series B in Q1 2025 — scaling fast","How [Seller] helps post-funding ops teams like Acme scale","email"
...
```

---

## Terminal Output

Display a concise summary to the user upon completion:

```
╔════════════════════════════════════════════════════════════╗
║  SALES LEADS COMPLETE                                      ║
╚════════════════════════════════════════════════════════════╝

Seller: [Company Name] ([URL])
ICP Generated: [Industries] | [Size] | [Geography]

LEADS FOUND: [N] total

  Grade A (80–100):     [N] ████████░░ (hot leads)
  Grade B (60–79):      [N] ██████░░░░ (strong leads)
  Grade C (40–59):      [N] ████░░░░░░ (warm leads)
  Grade D (0–39):       [N] ██░░░░░░░░ (cold leads)

BUYING SIGNALS DETECTED:

  Recent Funding:       [N] ██████████ ([N]% of leads)
  Hiring Signals:       [N] █████████░ ([N]% of leads)
  Tech Stack Match:     [N] ███████░░░ ([N]% of leads)
  Growth Signals:       [N] ████░░░░░░ ([N]% of leads)

TOP 3 LEADS TO PURSUE FIRST:

  1. [Company Name]     ([Grade]) — [qualification_reason truncated to 60 chars]
  2. [Company Name]     ([Grade]) — [...]
  3. [Company Name]     ([Grade]) — [...]

CONTACT COVERAGE: [N]% of leads have email confidence ≥ pattern_derived

CSV saved to: leads-[company-slug]-[YYYY-MM-DD].csv
```

Use ASCII progress bars: `████████░░` (filled and empty blocks).

---

## Error Handling

### Recoverable Errors (Proceed with What's Found)

**Seller URL unreachable:**
- Attempt www-variant (if given `vranceflex.online`, try `www.vranceflex.online`)
- After 2 attempts, exit with error: "Cannot reach seller website. Verify URL is correct and try again."

**Fewer leads than target `count`:**
- If Phase 3 discovers fewer unique companies than `count`, proceed with all found companies
- Note in terminal output: "Target: 30 leads | Found: 23 leads after search and dedup"
- Include a note: "Increase ICP scope or broaden search geography to find more leads"

**Company website returns 403/429:**
- Skip WebFetch for that company
- Use only search-derived data (company name, industry from search results)
- Mark all company data as `confidence = "low"`
- Proceed to next company

**No contact found for company:**
- Leave contact fields blank: `contact_name = "Unknown"`, `contact_email = ""`, `email_confidence = "unknown"`
- Include company in final CSV
- Log in terminal: "[Company X] — no contact found, including with generic contact row"

**`count` parameter exceeds 100:**
- Cap at 100 automatically
- Warn user: "Requested 150 leads; capped at 100 maximum per skill execution"

**`count` parameter is invalid (non-integer, negative, zero):**
- Default to 20
- Warn user: "Invalid count. Defaulting to 20 leads"

**No ICP can be generated (Phase 2 fails):**
- Suggest: "Run `/sales icp <description>` first to define your ideal customer profile, then re-run `/sales leads`"
- Exit gracefully

### Fatal Errors (Exit)

**Seller URL is completely invalid:**
- Exit: "Invalid URL. Example: `/sales leads https://mycompany.com 30`"

**Both WebFetch and WebSearch fail entirely:**
- Exit: "Unable to execute web research. Check internet connection and retry."

---

## Cross-Skill Integration

### Reading Existing ICP

- If `IDEAL-CUSTOMER-PROFILE.md` exists in the current working directory, **read it at the start of Phase 2** and skip ICP generation
- This allows users to run `/sales icp <description>` first to craft a custom ICP, then `/sales leads` will use it
- Removes redundant research if ICP is already refined

### Outputs

- Writes `leads-<slug>-<YYYY-MM-DD>.csv` to the current working directory
- CSV is immediately usable in Excel, Google Sheets, or any CRM import tool

### Suggested Follow-ups

After `/sales leads completes, suggest these commands:

1. **For deep-dive on any lead:** `/sales prospect <lead-url>` — analyzes the lead company with 5 parallel agents
2. **For outreach sequences:** `/sales outreach <company-name>` — generates personalized cold email sequences
3. **For follow-up sequences:** `/sales followup <company-name>` — creates follow-up email cadences
4. **For pipeline view:** `/sales report` — compiles all prospect analyses into a unified pipeline report

### Cross-Skill Files to Reference

- If `COMPANY-RESEARCH.md` exists (from a prior `/sales research` run), mention that existing company research can contextualize new leads
- If `COMPETITIVE-INTEL.md` exists, suggest using it to refine ICP against competitor customer profiles

---

## Implementation Notes for Claude

1. **Web Scraping Accuracy:** Focus on extracting data directly from HTML; avoid assumptions. If a field cannot be found, leave it blank or mark as "Unknown".

2. **Email Pattern Derivation:** Only apply patterns if you see at least 2–3 example emails on the company website that follow the same format. Do not guess formats.

3. **Funding Date Precision:** If exact date is unknown, use "2024" or "Q2 2024" or "Recent" rather than guessing.

4. **Headcount Estimation:** Prefer exact numbers from LinkedIn or press releases. If only ranges are available, use ranges (e.g., "50–100 employees"). Do not average or estimate.

5. **Tech Stack Matching:** Only flag tech stack match if at least one tool from `seller_tech_keywords` (Phase 1) is found in the company's job postings or integrations page.

6. **Grade Justification:** Every score must be justifiable from the 5 dimensions. No arbitrary scores. Show math: "ICP Fit: 30/35 + Hiring: 14/20 + Funding: 10/15 + Tech: 10/15 + Growth: 14/15 = 78/100 (Grade B)".

7. **Performance:** Phase 4 and 5 involve N companies. To optimize, interleave per-company enrichment: WebFetch homepage → WebSearch funding → WebSearch contact → Store → Next company. Do not wait for all companies to complete Phase 4 before starting Phase 5.

8. **Fallback for CSV:** If `generate_leads_csv.py` is unavailable (Python not found), write the CSV directly using Python's `csv` standard library equivalent implemented in Claude (or manually format as valid CSV text).

---

*Generated by AI Sales Team — Lead Generation Engine `/sales leads`*
