# Supabase OAuth 2.1 Setup for Sales AI

## 1) Enable OAuth Server
Dashboard:
- Authentication -> OAuth Server -> Enable
- Authorization Path: `/oauth/consent`

Local config (CLI): `supabase/local/config.oauth.toml`

```toml
[auth.oauth_server]
enabled = true
authorization_url_path = "/oauth/consent"
allow_dynamic_registration = false
```

## 2) Ensure Site URL points to your web app
Set Site URL to:
- Production: `https://sales-ai.app`
- Local: `http://localhost:3001`

## 3) Build consent route
Implemented at: `apps/web/app/oauth/consent/page.tsx`

Flow:
1. Read `authorization_id` from query
2. Require Supabase session
3. Call `supabase.auth.oauth.getAuthorizationDetails(authorization_id)`
4. Show consent details + scopes
5. Call approve/deny and redirect to `redirect_to`

## 4) Register OAuth clients
Dashboard:
- Authentication -> OAuth Apps -> Add client

Use:
- Confidential for server apps
- Public for SPA/mobile

## 5) Token validation (clients)
- Discovery: `https://<project-ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1`
- JWKS: `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`

## 6) Recommended for production
- Use asymmetric signing keys (RS256/ES256)
- Separate OAuth clients per environment
- Keep dynamic registration disabled unless required