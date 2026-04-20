import { getVercelOidcToken } from "@vercel/oidc";
import { GoogleAuth } from "google-auth-library";

type ServiceAccountJson = {
  client_email?: string;
  private_key?: string;
  project_id?: string;
  [key: string]: unknown;
};

type WifConfig = {
  projectNumber: string;
  serviceAccountEmail: string;
  poolId: string;
  providerId: string;
};

type StsTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  issued_token_type?: string;
  error?: string;
  error_description?: string;
};

type IamGenerateIdTokenResponse = {
  token?: string;
};

let cachedAuthHeader: string | null = null;
let cachedExpiresAtMs = 0;

function normalizeBearer(rawToken: string): string {
  return rawToken.toLowerCase().startsWith("bearer ") ? rawToken : `Bearer ${rawToken}`;
}

function extractTokenFromBearer(rawToken: string): string {
  return rawToken.replace(/^Bearer\s+/i, "").trim();
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

function getWifConfigFromEnv(): WifConfig | null {
  const projectNumber =
    process.env.GCP_PROJECT_NUMBER?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT_NUMBER?.trim() ||
    process.env.GOOGLE_PROJECT_NUMBER?.trim();

  const serviceAccountEmail =
    process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim() ||
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ||
    process.env.SALES_API_INVOKER_SERVICE_ACCOUNT?.trim();

  let poolId =
    process.env.GCP_WORKLOAD_IDENTITY_POOL_ID?.trim() ||
    process.env.GCP_WIF_POOL_ID?.trim() ||
    process.env.GOOGLE_WORKLOAD_IDENTITY_POOL_ID?.trim();

  let providerId =
    process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID?.trim() ||
    process.env.GCP_WIF_PROVIDER_ID?.trim() ||
    process.env.GOOGLE_WORKLOAD_IDENTITY_POOL_PROVIDER_ID?.trim();

  const providerResource =
    process.env.GCP_WORKLOAD_IDENTITY_PROVIDER?.trim() ||
    process.env.GCP_WIF_PROVIDER_RESOURCE?.trim();

  if (providerResource && (!poolId || !providerId)) {
    const match = providerResource.match(/workloadIdentityPools\/([^/]+)\/providers\/([^/]+)/i);
    if (match) {
      poolId = poolId || match[1];
      providerId = providerId || match[2];
    }
  }

  if (!projectNumber || !serviceAccountEmail || !poolId || !providerId) {
    return null;
  }

  return {
    projectNumber,
    serviceAccountEmail,
    poolId,
    providerId,
  };
}

async function mintIdTokenHeaderFromWif(audience: string, config: WifConfig): Promise<string | null> {
  const subjectToken = await getVercelOidcToken();
  const stsAudience = `//iam.googleapis.com/projects/${config.projectNumber}/locations/global/workloadIdentityPools/${config.poolId}/providers/${config.providerId}`;
  const stsBody = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    audience: stsAudience,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    subject_token: subjectToken,
  });

  const stsResp = await fetch("https://sts.googleapis.com/v1/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: stsBody.toString(),
  });

  const stsJson = (await stsResp.json()) as StsTokenResponse;
  if (!stsResp.ok || !stsJson.access_token) {
    throw new Error(
      `STS exchange failed (${stsResp.status}): ${stsJson.error_description || stsJson.error || "unknown error"}`
    );
  }

  const iamResp = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(config.serviceAccountEmail)}:generateIdToken`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stsJson.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audience,
        includeEmail: true,
      }),
    }
  );

  const iamJson = (await iamResp.json()) as IamGenerateIdTokenResponse & {
    error?: { message?: string };
  };
  if (!iamResp.ok || !iamJson.token) {
    throw new Error(
      `IAM generateIdToken failed (${iamResp.status}): ${iamJson.error?.message || "unknown error"}`
    );
  }

  const token = iamJson.token;
  const expMs = decodeJwtExpMs(token);
  cachedAuthHeader = normalizeBearer(token);
  cachedExpiresAtMs = expMs || Date.now() + 50 * 60 * 1000;

  return cachedAuthHeader;
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
  const now = Date.now();
  if (cachedAuthHeader && cachedExpiresAtMs - 60_000 > now) {
    return cachedAuthHeader;
  }

  const wifConfig = getWifConfigFromEnv();
  if (wifConfig) {
    try {
      return await mintIdTokenHeaderFromWif(audience, wifConfig);
    } catch (error) {
      console.error("Failed to mint Cloud Run ID token via Vercel OIDC/WIF", error);
    }
  }

  const credentials = getServiceAccountJsonFromEnv();
  if (credentials) {
    try {
      return await mintIdTokenHeader(audience, credentials);
    } catch (error) {
      console.error("Failed to mint Cloud Run ID token via service account JSON", error);
    }
  }

  const staticBearer = process.env.SALES_API_BEARER_TOKEN?.trim();
  if (!staticBearer) return null;

  const staticToken = extractTokenFromBearer(staticBearer);
  const staticExpMs = decodeJwtExpMs(staticToken);

  if (staticExpMs && staticExpMs - 60_000 <= now) {
    // Ignore expired manually pasted identity tokens so WIF/SA flows can take over.
    console.warn("Ignoring expired SALES_API_BEARER_TOKEN; configure WIF env vars for keyless auth.");
    return null;
  }

  return normalizeBearer(staticBearer);
}
