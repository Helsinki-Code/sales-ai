# How to Build a BYOK SaaS on Top of an LLM — The Complete Architecture Guide

<!-- ============================================================
SEO METADATA
Title tag (58 chars): BYOK LLM SaaS Architecture: The Complete Builder's Guide
Meta description (158 chars): Building a SaaS where users bring their own Anthropic or OpenAI key? Here's the full architecture: key storage, AES-256-GCM, Supabase RLS, cost separation, and billing strategy.
Primary keyword: bring your own key LLM SaaS
Secondary keywords: BYOK SaaS architecture, LLM SaaS BYOK, API key encryption SaaS, Supabase RLS multi-tenant LLM, BYOK pricing model SaaS
URL slug: /blog/bring-your-own-key-llm-saas
Schema type: TechArticle + FAQPage + HowTo
============================================================ -->

**Published:** April 2026 | **Reading time:** 14 min | **Audience:** SaaS developers, technical founders building AI products

---

<!-- ============================================================
FEATURED IMAGE
Image gen prompt: Cinematic dark-mode architectural diagram illustration. A multi-layer system architecture stack shown as horizontal floating planes stacked vertically with perspective. Top plane: "Your SaaS Frontend / API" (blue). Second plane: "Workspace & Tenant Layer — Supabase RLS" (purple). Third plane: "Key Vault — AES-256-GCM Encrypted Storage" (gold, glowing). Fourth plane: "LLM Provider Layer — Anthropic / OpenAI" (electric blue). Between plane 3 and 4, a small key icon shows "user key, decrypted in memory only" with a brief pulse animation hint. On the right side, two separate billing arrows flow down: one from plane 1 labelled "Platform Fee → You" and one from plane 4 labelled "Token Costs → User". Background: very dark charcoal. Ultra-detailed, professional, 4K, 16:9.
Alt tag: BYOK LLM SaaS architecture diagram showing layered system with frontend, Supabase RLS tenant isolation, AES-256-GCM key vault, and LLM provider layer with separated billing flows
============================================================ -->

---

> **Who this is for:** You're building a SaaS product that uses LLMs (Anthropic Claude, OpenAI GPT, etc.) and you want users to supply their own API keys instead of paying you for AI tokens. This guide covers everything you need to ship a production-grade BYOK implementation: encryption, tenant isolation, key forwarding, cost separation, and billing strategy.

---

## Table of Contents

1. [Why BYOK Wins on Pricing Psychology](#why-byok-wins)
2. [The Complete BYOK Architecture](#the-complete-byok-architecture)
3. [Layer 1: Key Encryption (AES-256-GCM)](#layer-1-key-encryption)
4. [Layer 2: Tenant Isolation (Supabase RLS)](#layer-2-tenant-isolation)
5. [Layer 3: In-Memory Key Forwarding](#layer-3-in-memory-key-forwarding)
6. [Layer 4: Separating Platform Billing From LLM Costs](#layer-4-billing-separation)
7. [Layer 5: Scoped Keys and Key Rotation](#layer-5-scoped-keys)
8. [How Sales AI Uses This Architecture](#how-sales-ai-uses-this-architecture)
9. [Common Mistakes and How to Avoid Them](#common-mistakes)
10. [FAQ: BYOK LLM SaaS Architecture](#faq-byok-llm-saas-architecture)

---

## Why BYOK Wins on Pricing Psychology

Before getting into architecture, it's worth understanding *why* BYOK is the right pricing model for most LLM SaaS products.

**The problem with vendor-billing LLM costs:**

When you absorb LLM costs and build them into your subscription, you face three problems:

1. **Cost unpredictability.** LLM costs vary wildly by usage. A user who runs 10,000 qualification calls a month costs you 10,000x more than a user who runs 10. Flat subscriptions don't cover this without aggressive throttling.

2. **Pricing complexity.** You need to either: (a) tier by AI usage, which creates a confusing matrix of AI credits and overages, or (b) charge enough to cover the heavy users, which makes you unaffordable for lighter ones.

3. **Trust deficit.** Developers don't trust "unlimited AI" plans. They know someone is paying for those tokens and the only question is how much the markup is.

**BYOK solves all three:**

- Your costs are fixed — you charge for platform infrastructure, not variable compute
- Pricing is simple — one flat fee for features, zero for AI usage
- Trust is immediate — users see their token spend directly in their Anthropic or OpenAI dashboard

This is why [Kinde's BYOK billing guide](https://www.kinde.com/learn/billing/billing-for-ai/byok-pricing/) describes the model as separating the platform value from compute costs — making your pricing credible and your margins predictable.

[JetBrains' BYOK launch announcement](https://blog.jetbrains.com/ai/2025/12/bring-your-own-key-byok-is-now-live-in-jetbrains-ides/) frames it explicitly: *"No vendor lock-in means you're now free to choose your preferred AI provider — full transparency over costs on your selected platform, no hidden quotas."*

<!-- ============================================================
IMAGE 1 — BYOK Pricing Model Advantage
Image gen prompt: Dark navy background. Three-column comparison grid showing "Problem" (red), "Vendor-Billed Result" (amber), "BYOK Result" (green). Row 1: "Unpredictable costs" → "Absorb heavy users, throttle or overprice" → "User pays their own Anthropic bill". Row 2: "Pricing complexity" → "AI credit tiers, overage fees" → "One flat platform fee". Row 3: "Developer trust" → "Scepticism about markups" → "Full cost transparency via API console". Clean grid design, icons for each row. No people. 16:9.
Alt tag: BYOK LLM SaaS pricing model advantages showing how bring your own key solves unpredictable costs, pricing complexity, and developer trust versus vendor-billed model
============================================================ -->

---

## The Complete BYOK Architecture

Here is the full system diagram for a production BYOK LLM SaaS:

```
User Browser/Client
    ↓ API call with workspace token
Your API Server (FastAPI / Next.js API routes)
    ↓ Authenticate request
    ↓ Lookup workspace → fetch encrypted key from DB
    ↓ Decrypt key in memory (AES-256-GCM)
    ↓ Forward request to LLM provider with user's key
Anthropic / OpenAI API
    ↓ Bills user's Anthropic/OpenAI account for tokens
    ↓ Returns response to your server
Your API Server
    ↓ Structure / transform response
    ↓ Discard plaintext key from memory
    ↓ Log usage (tokens, duration, endpoint) — NO key in logs
    ↓ Return structured response to user
    ↓ Stripe bills user's payment method for platform fee
```

Five distinct layers, each with a specific responsibility:

| Layer | Technology | Responsibility |
|---|---|---|
| Key Encryption | AES-256-GCM | Store keys safely at rest |
| Tenant Isolation | Supabase RLS / PostgreSQL | Prevent cross-tenant data access |
| Key Forwarding | Server memory | Use key for API call, never persist plaintext |
| Billing Separation | Stripe + LLM provider | Platform fee vs token costs are independent |
| Scoped Keys | Custom key minting | Limit access by endpoint or workspace |

---

## Layer 1: Key Encryption (AES-256-GCM)

AES-256-GCM is the right encryption algorithm for API keys at rest. Here's why each component matters:

- **AES** (Advanced Encryption Standard) — the symmetric cipher, government-grade
- **256** — key length in bits. 256-bit keys have 2^256 possible values — computationally unbreakable with current technology
- **GCM** (Galois/Counter Mode) — authenticated encryption. This means you detect any tampering with the ciphertext, not just decrypt it

The [NIST SP 800-38D specification](https://csrc.nist.gov/publications/detail/sp/800-38d/final) is the authoritative reference for GCM mode. It's the same standard used in TLS 1.3, disk encryption, and payment card data protection.

**Python implementation:**

```python
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

class APIKeyEncryption:
    def __init__(self, master_key_hex: str):
        """
        master_key_hex: 64-character hex string = 32 bytes = 256 bits
        Store this in your environment, never in code or database
        """
        self.master_key = bytes.fromhex(master_key_hex)
        self.cipher = AESGCM(self.master_key)

    def encrypt(self, plaintext_key: str) -> str:
        """
        Returns: nonce + ciphertext as hex string for database storage
        """
        nonce = os.urandom(12)  # 96-bit nonce, random for each encryption
        ciphertext = self.cipher.encrypt(nonce, plaintext_key.encode(), None)
        # Store nonce alongside ciphertext — needed for decryption
        return (nonce + ciphertext).hex()

    def decrypt(self, stored_hex: str) -> str:
        """
        Decrypts stored hex string back to plaintext key.
        Call this immediately before the API call. Discard result after.
        """
        raw = bytes.fromhex(stored_hex)
        nonce = raw[:12]
        ciphertext = raw[12:]
        plaintext = self.cipher.decrypt(nonce, ciphertext, None)
        return plaintext.decode()

# Usage
encryptor = APIKeyEncryption(os.environ["MASTER_ENCRYPTION_KEY"])
encrypted = encryptor.encrypt("sk-ant-api03-your-key-here")
# Store `encrypted` in database, never the plaintext

# At call time:
plaintext_key = encryptor.decrypt(encrypted_from_db)
# Use key for API call, then let it go out of scope (Python GC handles memory)
```

**Key management rules:**
- `MASTER_ENCRYPTION_KEY` is an environment variable on your server — never in your database, never in your codebase
- Generate it with: `python -c "import os; print(os.urandom(32).hex())"`
- Rotate the master key periodically by re-encrypting all stored keys
- Use [Supabase Vault](https://supabase.com/docs/guides/database/vault) or AWS Secrets Manager for the master key in production

<!-- ============================================================
IMAGE 2 — AES-256-GCM Encryption Flow
Image gen prompt: Dark-mode technical diagram. Horizontal encryption pipeline. Input: "Anthropic API Key (plaintext)" shown as green text. Arrow right to "AES-256-GCM Encrypt" box (gold shield, shows: nonce (12 bytes) + master key). Arrow right to "Encrypted Ciphertext" shown as red indecipherable hex string. Arrow down to "Supabase Database" cylinder with lock icon. Small separate box below: "Master key stored in environment variable ONLY — never in DB". Clean dark background, precise flat design. No people. 16:9.
Alt tag: AES-256-GCM encryption flow for BYOK LLM SaaS showing Anthropic API key encrypted with master key and nonce stored in Supabase database with environment variable key management
============================================================ -->

---

## Layer 2: Tenant Isolation (Supabase RLS)

Row-Level Security (RLS) is a PostgreSQL feature that adds implicit WHERE clauses to every query, ensuring users can only access rows they're authorised to see. It's the correct isolation mechanism for multi-tenant SaaS — not application-layer filtering, which can have bugs.

[Makerkit's production RLS patterns](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — refined across 100+ production Supabase deployments — establish the standard architecture.

**Schema for BYOK key storage:**

```sql
-- Create the key storage table
CREATE TABLE workspace_api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    provider TEXT NOT NULL, -- 'anthropic' | 'openai'
    encrypted_key TEXT NOT NULL, -- AES-256-GCM ciphertext
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

-- Enable RLS
ALTER TABLE workspace_api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see keys for their own workspace
CREATE POLICY "workspace_key_isolation"
ON workspace_api_keys
FOR ALL
USING (
    workspace_id IN (
        SELECT id FROM workspaces
        WHERE org_id = (auth.jwt() ->> 'org_id')::UUID
    )
);

-- Policy: service role can access all (for server-side decryption only)
-- Service role bypasses RLS by default in Supabase
```

**Why RLS over application-layer filtering:**

```python
# WRONG — application-layer filter (has bugs potential)
def get_user_key(user_id: str, workspace_id: str):
    # Developer forgets the workspace_id filter in a future PR
    return db.query("SELECT * FROM workspace_api_keys WHERE user_id = ?", user_id)

# RIGHT — RLS enforced at database level (policy always applies)
def get_user_key(workspace_id: str):
    # RLS policy automatically adds WHERE workspace_id IN (...) 
    # No application code can forget it
    return supabase.table("workspace_api_keys").select("*").eq("workspace_id", workspace_id).execute()
```

The [Supabase security analysis by UIBakery](https://uibakery.io/blog/supabase-security) confirms: *"RLS is one of Supabase's standout security features. It allows you to define per-user access policies using SQL, ensuring that users can only query data they're authorised to see — particularly useful in multi-tenant apps."*

A 2025 vulnerability (CVE-2025-48757) affected 170+ apps on the Lovable platform precisely because RLS wasn't configured — exposing data for ~13,000 users. Don't skip this layer.

---

## Layer 3: In-Memory Key Forwarding

The calling pattern is critical. The plaintext key must exist in memory only for the duration of the API call.

**Python (FastAPI) implementation:**

```python
from fastapi import FastAPI, Depends, HTTPException
from contextlib import asynccontextmanager
import httpx

app = FastAPI()

async def get_anthropic_key(workspace_id: str) -> str:
    """
    Fetches and decrypts the Anthropic key for this workspace.
    Returns plaintext — caller must not persist this value.
    """
    # RLS policy on workspace_api_keys ensures this only returns
    # keys the authenticated user's workspace can access
    result = await supabase.table("workspace_api_keys") \
        .select("encrypted_key") \
        .eq("workspace_id", workspace_id) \
        .eq("provider", "anthropic") \
        .eq("is_active", True) \
        .single() \
        .execute()
    
    if not result.data:
        raise HTTPException(404, "No active Anthropic key found")
    
    return encryptor.decrypt(result.data["encrypted_key"])

@app.post("/api/v1/sales/qualify")
async def qualify_lead(payload: QualifyRequest, workspace_id: str = Depends(get_workspace_from_token)):
    # Decrypt key — plaintext_key is a local variable, not persisted
    plaintext_key = await get_anthropic_key(workspace_id)
    
    # Use key immediately for API call
    async with httpx.AsyncClient() as client:
        anthropic_response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": plaintext_key,  # ← user's key used here
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            json=build_qualification_prompt(payload),
            timeout=30.0
        )
    
    # plaintext_key goes out of scope here — Python GC handles cleanup
    # Never log plaintext_key, never include it in error messages
    
    return structure_qualification_response(anthropic_response.json())
```

**Critical logging rule:** Your logging middleware must explicitly exclude the `x-api-key` header from any request logging. A common mistake is logging all outbound HTTP headers for debugging — this would persist the plaintext key in your log store.

```python
# Safe logging — never include the actual key
logger.info(
    "Anthropic API call",
    workspace_id=workspace_id,
    endpoint="/v1/messages",
    key_prefix=plaintext_key[:8] + "...",  # Only log key prefix for debugging
    tokens_used=response.usage.input_tokens + response.usage.output_tokens
)
```

---

## Layer 4: Billing Separation

This is the simplest layer to implement but the most important to communicate to users. Your billing has two completely independent sources:

**Platform fee (you charge this):**
- Stripe subscription for access to your SaaS features
- Fixed monthly cost, not dependent on AI usage
- Managed entirely by you

**LLM costs (user pays this directly):**
- Anthropic or OpenAI bills the user's account for tokens consumed
- Uses the user's credit card, not yours
- You have zero visibility into spend amounts

**Implementation:**

```python
# When an API call completes, log the usage data
# You get token counts from the LLM provider response
# You DO NOT receive billing information

async def log_usage(workspace_id: str, endpoint: str, usage: dict):
    await supabase.table("usage_logs").insert({
        "workspace_id": workspace_id,
        "endpoint": endpoint,
        "input_tokens": usage["input_tokens"],
        "output_tokens": usage["output_tokens"],
        "model": usage["model"],
        "duration_ms": usage["duration_ms"],
        # Anthropic pricing at time of call (for user's reference only)
        "estimated_cost_usd": calculate_estimated_cost(usage)
    }).execute()

# Surface this in your dashboard so users can see
# their consumption — even though they're billed by Anthropic directly
```

Show users their token consumption in your dashboard. This gives them cost visibility without you needing to actually handle billing for LLM usage. The [Anthropic API pricing page](https://platform.claude.com/docs/en/about-claude/pricing) is the authoritative reference for current per-token rates that you can surface in your dashboard estimates.

<!-- ============================================================
IMAGE 3 — Billing Separation Architecture
Image gen prompt: Dark-mode dual billing flow diagram. Top center: "Your SaaS Platform" box. Two arrows flow down, one left and one right. LEFT ARROW to "Stripe" (label: "Platform subscription fee → Platform bank account"). RIGHT ARROW to "Anthropic/OpenAI API" (label: "Token costs → billed to USER's API account"). Under the right arrow, a small note: "You never see token costs. Anthropic bills user directly." Clean separation visual, no overlap between the two billing flows. Dark navy background. Professional flat design. No people. 16:9.
Alt tag: BYOK LLM SaaS billing separation diagram showing platform subscription fee going to Stripe and LLM token costs billed directly to user's Anthropic or OpenAI account separately
============================================================ -->

---

## Layer 5: Scoped Keys and Key Rotation

Let users mint multiple workspace keys with different permissions. This limits blast radius if one integration is compromised.

**Schema:**

```sql
CREATE TABLE workspace_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    key_hash TEXT NOT NULL, -- bcrypt hash of the key prefix
    key_prefix TEXT NOT NULL, -- first 8 chars, shown in UI
    allowed_endpoints TEXT[], -- null = all endpoints
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- null = no expiry
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMPTZ
);
```

**Key minting:**

```python
import secrets
import bcrypt

def mint_workspace_key(workspace_id: str, allowed_endpoints: list = None) -> tuple[str, str]:
    """
    Returns (full_key, key_id) — full_key shown once, then discarded
    """
    # Generate a cryptographically random key
    raw_key = f"wk_{secrets.token_urlsafe(32)}"
    
    # Hash for storage (bcrypt, not SHA — bcrypt is slow on purpose)
    key_hash = bcrypt.hashpw(raw_key.encode(), bcrypt.gensalt(12)).decode()
    
    # Store hash, not the key
    result = supabase.table("workspace_keys").insert({
        "workspace_id": workspace_id,
        "key_hash": key_hash,
        "key_prefix": raw_key[:8],
        "allowed_endpoints": allowed_endpoints
    }).execute()
    
    # Return full key to user — this is the only time they'll see it
    return raw_key, result.data[0]["id"]

# Verification at request time
def verify_workspace_key(raw_key: str, endpoint: str) -> Optional[str]:
    """Returns workspace_id if key is valid and allowed for this endpoint."""
    prefix = raw_key[:8]
    
    # Find candidates by prefix (prefix is not secret, just a lookup aid)
    candidates = supabase.table("workspace_keys") \
        .select("*") \
        .eq("key_prefix", prefix) \
        .eq("is_active", True) \
        .execute()
    
    for candidate in candidates.data:
        if bcrypt.checkpw(raw_key.encode(), candidate["key_hash"].encode()):
            # Check endpoint permission
            if candidate["allowed_endpoints"] and endpoint not in candidate["allowed_endpoints"]:
                return None
            # Update last_used_at
            update_last_used(candidate["id"])
            return candidate["workspace_id"]
    
    return None
```

[Makerkit's secure API key management guide](https://makerkit.dev/blog/tutorials/supabase-api-key-management) covers this pattern in depth, including the bcrypt-over-SHA256 rationale: *"SHA-256 is fast by design, which is bad for secrets. Bcrypt's cost factor makes bulk attacks impractical."*

---

## How Sales AI Uses This Architecture

Sales AI is built on exactly this architecture. The [sales-ai-web-eta.vercel.app/security](/security) page documents the production implementation:

- **Key storage:** AES-256-GCM encryption before database write, master key in environment
- **Tenant isolation:** Supabase RLS policies on all key-related tables
- **Key forwarding:** Decryption in memory only, discarded immediately after call
- **Billing separation:** Anthropic bills your account directly; Sales AI charges a platform subscription only
- **Scoped keys:** Users can mint workspace keys limited to specific endpoints

The platform runs 15 sales AI endpoints (`/sales/qualify`, `/sales/research`, `/sales/outreach`, etc.) all using this architecture. [See the full API reference →](/docs/api-reference)

---

## Common Mistakes and How to Avoid Them

**Mistake 1: Storing plaintext keys in the database**
Even temporarily. Even in a "users" table with a `anthropic_key` column. Encrypt before write. Always.

**Mistake 2: Logging the decrypted key**
Structured logging frameworks often log all local variables or HTTP headers by default. Explicitly exclude the key. Use only the prefix for debugging.

**Mistake 3: Skipping RLS and filtering in application code**
Application-layer filters can be bypassed by bugs, missing conditions, or future code changes. RLS is enforced by the database — it can't be forgotten.

**Mistake 4: Using a shared master encryption key for all tenants**
If your master key leaks, all tenant keys are compromised. Consider per-tenant master keys derived from a global secret using HKDF — [Supabase Vault](https://supabase.com/docs/guides/database/vault) provides this out of the box.

**Mistake 5: No key rotation mechanism**
Users need to be able to update their LLM provider key without re-onboarding. Build key rotation from day one: add a new key, verify it, mark the old one inactive.

**Mistake 6: Conflating platform billing with LLM billing**
Track token usage in your usage_logs table, but make clear to users — in UI copy, in docs, in the onboarding flow — that Anthropic/OpenAI bills their account directly. If this isn't explicit, you'll get support tickets asking why their Anthropic bill went up.

<!-- ============================================================
IMAGE 4 — Common BYOK Mistakes Checklist
Image gen prompt: Dark-mode checklist card on charcoal background. Title: "BYOK Architecture Checklist" in white. 8 items in two columns, each with a checkbox (green checkmark for "do" items, red X for "don't" items). Examples: ✅ "Encrypt keys with AES-256-GCM before DB write" | ❌ "Log decrypted key in error messages" | ✅ "Use Supabase RLS for tenant isolation" | ❌ "Filter by workspace_id in app code only" | ✅ "Decrypt in memory, discard immediately" | ❌ "Cache plaintext keys for performance" | ✅ "Show users their token usage (not the actual key)" | ❌ "Use same master key for all tenants". Clean card design, two-column grid, subtle code-style font. No people. 16:9.
Alt tag: BYOK LLM SaaS architecture checklist showing correct practices like AES-256-GCM encryption and Supabase RLS versus mistakes like logging decrypted keys or skipping tenant isolation
============================================================ -->

---

## FAQ: BYOK LLM SaaS Architecture

### How do I implement BYOK in a SaaS product?

In five layers: (1) Encrypt user API keys with AES-256-GCM before storing them. (2) Isolate per-tenant data using Supabase Row-Level Security. (3) Decrypt keys only in memory when making LLM API calls — never persist plaintext. (4) Separate platform billing (Stripe, flat fee) from LLM billing (user's Anthropic/OpenAI account). (5) Let users mint scoped workspace keys with endpoint-level permissions.

### How do I store API keys securely in a database?

Never store plaintext API keys. Use AES-256-GCM authenticated encryption: generate a server-side master key (256-bit, stored in environment variables only), encrypt the API key before writing to the database, store the nonce alongside the ciphertext, and decrypt only in memory at call time. [NIST SP 800-38D](https://csrc.nist.gov/publications/detail/sp/800-38d/final) is the standard reference for GCM mode.

### What encryption should I use for API keys?

AES-256-GCM. Not SHA-256 (too fast, designed for hashing not encryption). Not AES-128 (shorter key). Not bcrypt alone (designed for passwords, not symmetric encryption). AES-256-GCM provides confidentiality (encryption) and integrity (authentication) — meaning you detect tampering, not just unauthorised access.

### How do I separate LLM costs from platform billing?

Route LLM API calls using the user's API key — Anthropic or OpenAI bills their account directly. You never see the token spend. For platform billing, use Stripe for a flat subscription fee covering your infrastructure and features. Show users their token consumption (from usage logs) in your dashboard so they can monitor their LLM spend — even though you don't handle that billing.

### Is BYOK pricing better for SaaS?

Yes, for most LLM SaaS products. BYOK makes your costs predictable (you're not absorbing variable LLM spend), your pricing simple (flat fee, no AI credit tiers), and your product credible to developers (who distrust opaque AI usage pricing). The tradeoff is that users must have their own API keys — which filters out non-technical users. For developer-facing products, this is usually the right trade.

### What is Supabase RLS and why do I need it for BYOK?

Row-Level Security (RLS) is a PostgreSQL feature that makes every database query automatically scoped to the requesting user's data. In a BYOK SaaS, it ensures that one tenant's encrypted API keys are never returned in another tenant's queries — regardless of application code. Without RLS, a single missing WHERE clause in your app code could expose all tenant keys. [The Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Makerkit's production patterns](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) cover the implementation in depth.

### Can I use this architecture for OpenAI as well as Anthropic?

Yes. The architecture is provider-agnostic. Store the provider name alongside the encrypted key (`provider: "anthropic"` or `provider: "openai"`). At call time, branch on the provider to use the correct SDK or HTTP endpoint. The encryption, RLS isolation, in-memory decryption, and billing separation work identically for both.

---

## Related Resources

- [Sales AI Security Architecture — this pattern in production →](/security)
- [Sales AI Pricing — BYOK billing model →](/pricing)
- [BYOK AI Tool Overview — what BYOK means for users →](/blog/byok-ai-tool)
- [Sales AI API — 15 BYOK sales endpoints →](/blog/sales-ai-api)
- [Supabase Row-Level Security Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Makerkit: Supabase RLS Production Patterns](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Makerkit: Secure Supabase API Key Management](https://makerkit.dev/blog/tutorials/supabase-api-key-management)
- [NIST AES-256-GCM Standard (SP 800-38D)](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
- [Anthropic API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Supabase Vault — encrypted secret storage](https://supabase.com/docs/guides/database/vault)
- [Kinde: BYOK Pricing Strategy for SaaS](https://www.kinde.com/learn/billing/billing-for-ai/byok-pricing/)

---

<!-- SCHEMA MARKUP
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "TechArticle",
      "headline": "How to Build a BYOK SaaS on Top of an LLM — The Complete Architecture Guide",
      "description": "Building a SaaS where users bring their own Anthropic or OpenAI key? Full architecture guide: AES-256-GCM key encryption, Supabase RLS tenant isolation, in-memory key forwarding, billing separation, and scoped key management.",
      "url": "https://sales-ai-web-eta.vercel.app/blog/bring-your-own-key-llm-saas",
      "datePublished": "2026-04-20",
      "dateModified": "2026-04-20",
      "programmingLanguage": ["Python", "SQL"],
      "proficiencyLevel": "Advanced"
    },
    {
      "@type": "HowTo",
      "name": "How to Implement BYOK in a SaaS Product",
      "step": [
        {"@type": "HowToStep", "name": "Encrypt keys with AES-256-GCM", "text": "Use AES-256-GCM with a server-side master key stored in environment variables. Encrypt before writing to database."},
        {"@type": "HowToStep", "name": "Implement Supabase RLS for tenant isolation", "text": "Enable Row-Level Security on the api_keys table and create workspace-scoped policies."},
        {"@type": "HowToStep", "name": "Decrypt in memory only", "text": "Fetch and decrypt the key only at API call time. Never log or persist the plaintext."},
        {"@type": "HowToStep", "name": "Separate billing streams", "text": "Use Stripe for your platform fee. LLM provider bills the user's account directly."},
        {"@type": "HowToStep", "name": "Implement scoped key rotation", "text": "Let users mint workspace keys with endpoint-level permissions and support rotation without re-onboarding."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {"@type": "Question", "name": "How do I implement BYOK in a SaaS product?", "acceptedAnswer": {"@type": "Answer", "text": "Encrypt user API keys with AES-256-GCM before storage, isolate tenants with Supabase RLS, decrypt only in memory during API calls, separate platform billing from LLM billing, and implement scoped workspace keys."}},
        {"@type": "Question", "name": "What encryption should I use for API keys?", "acceptedAnswer": {"@type": "Answer", "text": "AES-256-GCM — the NIST-recommended authenticated encryption standard. It provides both confidentiality and integrity verification, unlike SHA-256 which is a hash function not an encryption algorithm."}},
        {"@type": "Question", "name": "Is BYOK pricing better for SaaS?", "acceptedAnswer": {"@type": "Answer", "text": "Yes for developer-facing LLM products. BYOK makes your costs predictable, your pricing simple, and builds developer trust. Users pay LLM providers directly at published rates — no markup, no opaque credit systems."}}
      ]
    }
  ]
}
-->
