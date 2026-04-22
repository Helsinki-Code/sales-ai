# How to Store User API Keys Safely: AES-256-GCM Encryption in Production

<!-- ============================================================
SEO METADATA
Title tag (58 chars): AES-256-GCM API Key Storage: Production Security Guide
Meta description (158 chars): Storing an Anthropic or OpenAI key for a user? One mistake and it's a breach. Here's the exact pattern — envelope encryption, AES-256-GCM, in-memory-only decryption — with Python and Node code.
Primary keyword: AES-256-GCM API key storage
Secondary keywords: store user API keys securely, encrypt API keys database, BYOK key storage encryption, API key encryption Python Node
URL slug: /blog/aes-256-gcm-api-key-storage
Schema type: TechArticle + FAQPage
============================================================ -->

**Published:** April 2026 | **Reading time:** 10 min | **Audience:** Backend developers building BYOK SaaS, security-conscious engineers

---

<!-- ============================================================
FEATURED IMAGE
Image gen prompt: Cinematic dark-mode developer security illustration. A glowing padlock sits at the centre of a clean circuit-board diagram. On the left flows "sk-ant-api03-..." in plain red text. An arrow passes through a golden encryption box labelled "AES-256-GCM" with a 12-byte nonce sparkle. On the right the same key becomes a dark grey encrypted hex string with a padlock badge. Below the diagram: a slim timeline bar — "plaintext exists: 12ms" in amber between two grey sections. Background: deep charcoal, subtle hex-grid texture. No people. 4K, 16:9.
Alt tag: AES-256-GCM API key storage diagram showing plaintext Anthropic key encrypted with nonce into ciphertext with in-memory-only decryption timeline
============================================================ -->

---

> **The problem in one sentence:** If you're building a BYOK product — letting users supply their own Anthropic, OpenAI, or similar API key — that key is the most sensitive credential in your system. Stored wrong, a single database breach exposes every user's key. Here's the exact encryption pattern that prevents that, with complete Python and Node.js code.

---

## Table of Contents

1. [Why Hashing Isn't the Answer](#why-hashing-isnt-the-answer)
2. [What AES-256-GCM Is and Why It's the Right Choice](#what-aes-256-gcm-is)
3. [The Envelope Encryption Pattern](#the-envelope-encryption-pattern)
4. [Python Implementation — Full Production Code](#python-implementation)
5. [Node.js Implementation — Full Production Code](#nodejs-implementation)
6. [In-Memory-Only Decryption — The Critical Rule](#in-memory-only-decryption)
7. [Key Rotation Without Downtime](#key-rotation)
8. [Combining With Supabase RLS for Tenant Isolation](#combining-with-supabase-rls)
9. [FAQ: AES-256-GCM API Key Storage](#faq)

---

## Why Hashing Isn't the Answer

The first instinct when storing a sensitive value is to hash it. Bcrypt for passwords. SHA-256 for tokens. But hashing doesn't work for BYOK API keys — and understanding why shapes the entire architecture.

**Hashing is one-way.** When a user submits their Anthropic key, you hash it and store the hash. When you need to make an API call *on their behalf*, you need the original key to send in the `Authorization` header. You can't get that back from a hash.

**The developer asking this question on GitHub put it precisely:**

> *"I need to save the API key in the database so that I can call an external service using the user's API key. In my case I need to be able to retrieve the original supplied API key to send to the external API."*

That's the constraint. You need reversible encryption, not a one-way hash. The [NIST SP 800-38D standard](https://csrc.nist.gov/publications/detail/sp/800-38d/final) for AES-GCM is the reference implementation for exactly this class of problem.

---

## What AES-256-GCM Is and Why It's the Right Choice

AES-256-GCM is authenticated symmetric encryption. Each component matters:

**AES** — Advanced Encryption Standard. A symmetric block cipher, meaning the same key encrypts and decrypts. Standardised by NIST. Used in TLS 1.3, disk encryption, payment card systems.

**256** — Key length in bits. 2²⁵⁶ possible keys. Computationally unbreakable with current and foreseeable technology. The NSA approves AES-256 for TOP SECRET data.

**GCM** — Galois/Counter Mode. This is the critical addition. GCM provides *authenticated encryption* — the ciphertext includes a 128-bit authentication tag that detects tampering. If anyone modifies the stored ciphertext, decryption fails with an authentication error rather than silently returning garbage. You get both confidentiality *and* integrity.

**Why not AES-256-CBC?** CBC mode provides confidentiality but not integrity — a tampered ciphertext may decrypt without error. CBC also requires padding and is vulnerable to padding oracle attacks. GCM has neither problem.

**Why not ChaCha20-Poly1305?** Both are excellent. ChaCha20 is faster on devices without hardware AES support (mobile chips). AES-256-GCM is faster on server CPUs with AES-NI instructions (which all modern x86 and ARM64 server hardware has). For API key storage on a server, AES-256-GCM is the standard choice — and the one recommended by [NIST SP 800-38D](https://csrc.nist.gov/publications/detail/sp/800-38d/final).

<!-- ============================================================
IMAGE 1 — AES-256-GCM vs alternatives comparison
Image gen prompt: Dark-mode comparison table card. Three rows: AES-256-GCM (green check), AES-256-CBC (amber warning), bcrypt (red X). Four columns: "Reversible", "Authenticated", "Server Performance", "NIST Standard". Clean tick/cross icons. Subtitle: "For BYOK API key storage, AES-256-GCM is the only correct answer." Charcoal background, minimal flat design. No people. 16:9.
Alt tag: AES-256-GCM API key storage comparison table showing advantages over AES-256-CBC and bcrypt for reversible authenticated encryption with NIST standard approval
============================================================ -->

---

## The Envelope Encryption Pattern

Never encrypt directly with a static key embedded in your application. The correct pattern is **envelope encryption**:

```
User API key (plaintext)
    ↓ encrypted with
Data Encryption Key (DEK) — unique per key, stored encrypted
    ↓ encrypted with
Key Encryption Key (KEK) — stored in environment / secrets manager
```

**Why two layers?** If you store all keys encrypted with the same master key and that master key leaks, all user keys are compromised simultaneously. Envelope encryption limits the blast radius:

- The **KEK** lives in your environment variables or a secrets manager (AWS KMS, Supabase Vault, HashiCorp Vault). Never touches your database.
- The **DEK** is generated per-user (or per-workspace), encrypted with the KEK, and stored alongside the key ciphertext.
- **Rotating** the KEK means re-encrypting only the DEKs — not every user's key.

For most BYOK SaaS products at early scale, a single server-side KEK stored in your environment is sufficient and appropriate. Graduate to AWS KMS or [Supabase Vault](https://supabase.com/docs/guides/database/vault) when your security requirements demand it.

---

## Python Implementation — Full Production Code

```python
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

class APIKeyEncryption:
    """
    AES-256-GCM envelope encryption for BYOK API keys.
    
    The master key (KEK) is loaded from the environment.
    Never stored in the database alongside ciphertext.
    """
    
    NONCE_SIZE = 12   # 96 bits — NIST recommended for GCM
    KEY_SIZE   = 32   # 256 bits — AES-256
    
    def __init__(self, master_key_hex: str | None = None):
        """
        Load the master key from env if not provided.
        Generate with: python -c "import os; print(os.urandom(32).hex())"
        """
        hex_key = master_key_hex or os.environ.get("API_KEY_ENCRYPTION_KEY")
        if not hex_key:
            raise ValueError("API_KEY_ENCRYPTION_KEY not set in environment")
        if len(hex_key) != 64:
            raise ValueError("Master key must be 64 hex chars (32 bytes / 256 bits)")
        
        raw_key = bytes.fromhex(hex_key)
        self._cipher = AESGCM(raw_key)
    
    def encrypt(self, plaintext_api_key: str) -> str:
        """
        Encrypt an API key. Returns a hex string safe to store in the database.
        Format: nonce (12 bytes) || ciphertext+tag
        
        A fresh random nonce is generated for every encryption call.
        Nonce reuse with the same key breaks GCM security — random generation prevents this.
        """
        nonce = os.urandom(self.NONCE_SIZE)  # Cryptographically random 96-bit nonce
        ciphertext = self._cipher.encrypt(
            nonce,
            plaintext_api_key.encode("utf-8"),
            None   # No additional authenticated data in this pattern
        )
        # Prepend nonce to ciphertext so we can extract it at decrypt time
        return (nonce + ciphertext).hex()
    
    def decrypt(self, stored_hex: str) -> str:
        """
        Decrypt a stored API key. Returns the plaintext key.
        
        IMPORTANT: Assign the return value to a local variable.
        Use it immediately for the API call. Do not persist it.
        Let it go out of scope — Python GC handles memory cleanup.
        """
        try:
            raw = bytes.fromhex(stored_hex)
            nonce      = raw[:self.NONCE_SIZE]
            ciphertext = raw[self.NONCE_SIZE:]
            plaintext  = self._cipher.decrypt(nonce, ciphertext, None)
            return plaintext.decode("utf-8")
        except InvalidTag:
            # Authentication tag mismatch — ciphertext was tampered with
            raise ValueError("API key decryption failed: authentication tag invalid")
        except Exception as e:
            raise ValueError(f"API key decryption failed: {e}")
    
    @staticmethod
    def generate_master_key() -> str:
        """Generate a new 256-bit master key. Run once, store in secrets manager."""
        return os.urandom(32).hex()


# ── Usage ──────────────────────────────────────────────────────────────────

enc = APIKeyEncryption()  # loads API_KEY_ENCRYPTION_KEY from environment

# On user key submission — encrypt before writing to DB
user_anthropic_key = "sk-ant-api03-..."   # received from user
encrypted          = enc.encrypt(user_anthropic_key)
# → "7f3a9c2b...d8e1f4" (hex string, safe to store in DB)
db.execute("UPDATE workspaces SET anthropic_key_enc = $1 WHERE id = $2",
           encrypted, workspace_id)

# At API call time — decrypt in memory, use immediately, discard
def make_anthropic_call(workspace_id: str, payload: dict) -> dict:
    row           = db.fetchone("SELECT anthropic_key_enc FROM workspaces WHERE id = $1", workspace_id)
    plaintext_key = enc.decrypt(row["anthropic_key_enc"])   # local var only
    
    response = anthropic_client_with_key(plaintext_key).messages.create(**payload)
    # plaintext_key goes out of scope here — GC handles it
    return response
```

**Generating your master key:**
```bash
python -c "import os; print(os.urandom(32).hex())"
# → e3b0c44298fc1c14...  (64 hex chars — store this in your secrets manager)
```

---

## Node.js Implementation — Full Production Code

```typescript
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM  = "aes-256-gcm";
const NONCE_SIZE = 12;  // 96 bits
const TAG_SIZE   = 16;  // 128-bit auth tag (GCM default)

function loadMasterKey(): Buffer {
  const hex = process.env.API_KEY_ENCRYPTION_KEY;
  if (!hex) throw new Error("API_KEY_ENCRYPTION_KEY not set");
  if (hex.length !== 64) throw new Error("Master key must be 64 hex chars (32 bytes)");
  return Buffer.from(hex, "hex");
}

const MASTER_KEY = loadMasterKey();

/**
 * Encrypt a user API key. Returns hex string safe to store in DB.
 * Format: nonce (12 bytes) || ciphertext || auth tag (16 bytes)
 */
export function encryptApiKey(plaintextKey: string): string {
  const nonce  = randomBytes(NONCE_SIZE);
  const cipher = createCipheriv(ALGORITHM, MASTER_KEY, nonce);
  
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(plaintextKey, "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  
  // Store: nonce || ciphertext || tag — all needed for decryption
  return Buffer.concat([nonce, ciphertext, tag]).toString("hex");
}

/**
 * Decrypt a stored API key. Returns plaintext.
 * USE IMMEDIATELY — do not assign to a long-lived variable or log.
 */
export function decryptApiKey(storedHex: string): string {
  const raw        = Buffer.from(storedHex, "hex");
  const nonce      = raw.subarray(0, NONCE_SIZE);
  const tag        = raw.subarray(raw.length - TAG_SIZE);
  const ciphertext = raw.subarray(NONCE_SIZE, raw.length - TAG_SIZE);
  
  const decipher = createDecipheriv(ALGORITHM, MASTER_KEY, nonce);
  decipher.setAuthTag(tag);
  
  try {
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),   // throws if auth tag invalid (tampered ciphertext)
    ]);
    return plaintext.toString("utf8");
  } catch {
    throw new Error("API key decryption failed: authentication tag invalid");
  }
}

// ── Usage in Next.js API route ──────────────────────────────────────────

// POST /api/keys/add
export async function POST(req: Request) {
  const { apiKey, workspaceId } = await req.json();
  
  const encrypted = encryptApiKey(apiKey);  // encrypt before DB write
  await db.query(
    "UPDATE workspaces SET anthropic_key_enc = $1 WHERE id = $2",
    [encrypted, workspaceId]
  );
  
  return Response.json({ ok: true });
}

// At API call time
async function callAnthropicForWorkspace(workspaceId: string, payload: object) {
  const row     = await db.query("SELECT anthropic_key_enc FROM workspaces WHERE id = $1", [workspaceId]);
  const apiKey  = decryptApiKey(row.rows[0].anthropic_key_enc);  // local scope only
  
  // apiKey used here, then goes out of scope when function returns
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(payload),
  }).then(r => r.json());
}
```

<!-- ============================================================
IMAGE 2 — Encrypt/Decrypt lifecycle diagram
Image gen prompt: Dark-mode vertical flow diagram. Two parallel tracks. LEFT "At Key Submission": blue track. Step 1: "User submits sk-ant-..." Step 2: "randomBytes(12) → nonce" Step 3: "AESGCM.encrypt(nonce, key)" Step 4: "store hex(nonce+ciphertext) in DB". RIGHT "At API Call Time": green track. Step 1: "Fetch encrypted hex from DB". Step 2: "Extract nonce (first 12 bytes)". Step 3: "AESGCM.decrypt → plaintext". Step 4: "Use in Authorization header". Step 5: "Function returns → plaintext leaves scope". Connecting horizontal bar at the DB step. Clean dark background, blue and green accents. No people. 16:9.
Alt tag: AES-256-GCM API key storage lifecycle showing encryption at submission with nonce and master key storing ciphertext in database then decryption in memory at API call time
============================================================ -->

---

## In-Memory-Only Decryption — The Critical Rule

The encryption at rest is only half the story. The other half is how you handle the plaintext during API calls.

**The rule: plaintext API keys must never leave the memory of the active function call.**

This means:

```python
# ✅ CORRECT — plaintext in local scope, discarded on return
def call_anthropic(workspace_id: str) -> dict:
    key = enc.decrypt(get_encrypted_key(workspace_id))
    result = anthropic.messages.create(api_key=key, ...)
    return result
    # key goes out of scope here

# ❌ WRONG — plaintext assigned to instance variable (persists)
class WorkspaceClient:
    def __init__(self, workspace_id: str):
        self.api_key = enc.decrypt(...)  # lives as long as the object

# ❌ WRONG — plaintext logged (written to disk/stdout)
key = enc.decrypt(...)
logger.debug(f"Using key: {key}")  # now on disk

# ❌ WRONG — plaintext in error messages
try:
    result = call_anthropic(key)
except Exception as e:
    raise RuntimeError(f"Failed with key {key}: {e}")  # key in exception

# ❌ WRONG — plaintext in cache
redis.set(f"api_key:{workspace_id}", key, ex=300)  # now in Redis
```

**Logging middleware:** A common production pitfall is logging frameworks that capture all HTTP headers or all function arguments. Ensure your structured logger explicitly excludes keys containing `api_key`, `authorization`, or similar patterns. Use only the key prefix (first 8 characters) in logs for debugging identity without exposing the secret.

---

## Key Rotation Without Downtime

Your master key (KEK) needs to be rotatable — for security hygiene, compliance requirements, or when a suspected breach forces rotation.

**Pattern: dual-key support during rotation window**

```python
class RotatableAPIKeyEncryption:
    def __init__(self):
        self.current_key = bytes.fromhex(os.environ["API_KEY_ENCRYPTION_KEY"])
        # Optional: previous key for decryption during rotation window
        old_hex = os.environ.get("API_KEY_ENCRYPTION_KEY_OLD")
        self.old_key = bytes.fromhex(old_hex) if old_hex else None
    
    def encrypt(self, plaintext: str) -> str:
        """Always encrypts with the current (new) key."""
        nonce = os.urandom(12)
        ct = AESGCM(self.current_key).encrypt(nonce, plaintext.encode(), None)
        return (nonce + ct).hex()
    
    def decrypt(self, stored_hex: str) -> str:
        """Try current key first, fall back to old key during rotation."""
        raw = bytes.fromhex(stored_hex)
        nonce, ct = raw[:12], raw[12:]
        
        for key in filter(None, [self.current_key, self.old_key]):
            try:
                return AESGCM(key).decrypt(nonce, ct, None).decode()
            except Exception:
                continue
        
        raise ValueError("Could not decrypt with any known key")
    
    def re_encrypt(self, stored_hex: str) -> str:
        """Decrypt with old key, re-encrypt with current. Run as migration."""
        plaintext = self.decrypt(stored_hex)
        return self.encrypt(plaintext)
```

**Rotation process:**
1. Generate new KEK, set as `API_KEY_ENCRYPTION_KEY`
2. Set old KEK as `API_KEY_ENCRYPTION_KEY_OLD`
3. Deploy — decryption works for both old and new-encrypted keys
4. Run migration: re-encrypt all rows using `re_encrypt()`
5. Remove `API_KEY_ENCRYPTION_KEY_OLD` from environment
6. Deploy again — rotation complete, zero downtime

---

## Combining With Supabase RLS for Tenant Isolation

Encryption protects against database breaches. Row-Level Security (RLS) protects against application logic bugs — a missing `WHERE workspace_id = ?` that accidentally returns another tenant's encrypted key.

```sql
-- Enable RLS on your key storage table
ALTER TABLE workspace_api_keys ENABLE ROW LEVEL SECURITY;

-- Users can only access keys belonging to their workspace
CREATE POLICY "workspace_key_isolation"
ON workspace_api_keys
FOR ALL
USING (
    workspace_id IN (
        SELECT workspace_id
        FROM workspace_members
        WHERE user_id = auth.uid()
    )
);
```

With this policy active, even if application code omits a workspace filter, the database enforces it. A Supabase query with the user's JWT returns zero rows from other workspaces — not an error, just nothing. This is defence-in-depth: encryption protects the value itself, RLS protects which rows are visible.

[Sales AI's security architecture](/security) uses both layers: AES-256-GCM encryption for every stored key, RLS policies on all key-related tables, and in-memory-only decryption during API calls. [See the full BYOK architecture →](/blog/bring-your-own-key-llm-saas)

---

## FAQ: AES-256-GCM API Key Storage

### How do I encrypt user API keys in a database?

Use AES-256-GCM authenticated encryption. Generate a 256-bit master key (`os.urandom(32).hex()` in Python, `randomBytes(32).toString("hex")` in Node) and store it in your environment — never in the database. For each key, generate a random 12-byte nonce (`os.urandom(12)`), encrypt with `AESGCM(master_key).encrypt(nonce, plaintext, None)`, then store `(nonce + ciphertext).hex()`. At call time, split the stored hex into nonce and ciphertext, decrypt, use immediately in the API call, and discard. The plaintext should exist only as a local variable during the API call.

### Should I hash or encrypt user API keys?

Encrypt, not hash. Hashing is one-way — you can't recover the original key from a hash, so you can't forward it to Anthropic or OpenAI on the user's behalf. Use AES-256-GCM symmetric encryption so you can decrypt when needed. Bcrypt and SHA-256 are correct for passwords (where you verify a submitted value against a stored hash), not for secrets you need to retrieve.

### What is AES-256-GCM?

AES-256-GCM is authenticated symmetric encryption. AES is the cipher (Advanced Encryption Standard), 256 is the key length in bits, and GCM (Galois/Counter Mode) adds a 128-bit authentication tag that detects tampering. Unlike AES-CBC, GCM gives you both confidentiality (the ciphertext is unreadable without the key) and integrity (any modification to the ciphertext causes decryption to fail). It's standardised by [NIST SP 800-38D](https://csrc.nist.gov/publications/detail/sp/800-38d/final) and used in TLS 1.3, disk encryption, and payment card systems.

### How do I implement BYOK key storage?

The pattern: (1) User submits their API key. (2) You encrypt it with AES-256-GCM using a server-side master key from your environment. (3) Store only the encrypted hex string in your database. (4) When making an API call on their behalf, fetch the encrypted string, decrypt it in memory, use it for the call, and let it go out of scope. (5) Enable Supabase RLS on the key table so only the owning workspace can query it. Never store the master key in the database alongside the ciphertext. Full code above for Python and Node.js.

### How do I do per-tenant key encryption?

The simplest production pattern uses a single server-side master key (KEK) that encrypts all tenant keys. Tenant isolation is enforced at the query layer by Supabase RLS — each row has a `workspace_id`, and RLS policies ensure users can only query their own workspace's rows. For higher-assurance requirements (financial services, healthcare), generate a unique DEK per tenant, encrypt each DEK with the master KEK, and store the encrypted DEK alongside the tenant's encrypted key. This way, a breach of one tenant's DEK doesn't expose others.

---

## Related Resources

- [Sales AI Security Architecture — production implementation →](/security)
- [How to Build a BYOK SaaS on Top of an LLM →](/blog/bring-your-own-key-llm-saas)
- [Multi-Tenant Data Isolation With Supabase RLS →](/blog/supabase-rls-multi-tenant-saas)
- [NIST SP 800-38D — AES-GCM Standard](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
- [Supabase Vault — encrypted secret storage](https://supabase.com/docs/guides/database/vault)
- [Supabase Row-Level Security Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Makerkit: Supabase API Key Management Patterns](https://makerkit.dev/blog/tutorials/supabase-api-key-management)

---
<!-- SCHEMA: TechArticle + FAQPage, programmingLanguage: Python + TypeScript -->
