import { GoogleAuth } from "google-auth-library";

type ServiceAccountJson = {
  client_email?: string;
  private_key?: string;
  project_id?: string;
  [key: string]: unknown;
};

let cachedAuthHeader: string | null = null;
let cachedExpiresAtMs = 0;

function normalizeBearer(rawToken: string): string {
  return rawToken.toLowerCase().startsWith("bearer ") ? rawToken : `Bearer ${rawToken}`;
}

function decodeJwtExpMs(token: string): number {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return 0;
    const payload = parts[1] || "";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    const json = JSON.parse(decoded) as { exp?: number };
    return json.exp ? json.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

function parseServiceAccountJson(raw: string): ServiceAccountJson {
  const trimmed = raw.trim();
  const candidate = trimmed.startsWith("{")
    ? trimmed
    : Buffer.from(trimmed, "base64").toString("utf8");

  const parsed = JSON.parse(candidate) as ServiceAccountJson;
  if (typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return parsed;
}

function getServiceAccountJsonFromEnv(): ServiceAccountJson | null {
  const raw =
    process.env.GCP_RUN_INVOKER_SA_KEY_JSON ||
    process.env.GCP_SERVICE_ACCOUNT_KEY_JSON ||
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!raw) return null;

  try {
    return parseServiceAccountJson(raw);
  } catch (error) {
    console.error("Invalid service account JSON for Cloud Run invoker auth");
    return null;
  }
}

async function mintIdTokenHeader(audience: string, credentials: ServiceAccountJson): Promise<string | null> {
  const auth = new GoogleAuth({ credentials });
  const client = await auth.getIdTokenClient(audience);
  const reqHeaders = await client.getRequestHeaders();

  let headerValue: string | undefined;
  if (typeof (reqHeaders as any).get === "function") {
    headerValue =
      (reqHeaders as any).get("Authorization") ||
      (reqHeaders as any).get("authorization") ||
      undefined;
  } else {
    headerValue =
      (reqHeaders as Record<string, string | undefined>).Authorization ||
      (reqHeaders as Record<string, string | undefined>).authorization;
  }

  if (!headerValue) return null;

  const token = headerValue.replace(/^Bearer\s+/i, "");
  const expMs = decodeJwtExpMs(token);
  cachedAuthHeader = normalizeBearer(token);
  cachedExpiresAtMs = expMs || Date.now() + 50 * 60 * 1000;

  return cachedAuthHeader;
}

export async function getUpstreamAuthorizationHeader(audience: string): Promise<string | null> {
  const staticBearer = process.env.SALES_API_BEARER_TOKEN?.trim();
  if (staticBearer) {
    return normalizeBearer(staticBearer);
  }

  const now = Date.now();
  if (cachedAuthHeader && cachedExpiresAtMs - 60_000 > now) {
    return cachedAuthHeader;
  }

  const credentials = getServiceAccountJsonFromEnv();
  if (!credentials) return null;

  return mintIdTokenHeader(audience, credentials);
}
