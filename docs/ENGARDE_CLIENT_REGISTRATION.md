# Registering Flora as an OAuth Client on engarde-api

Roadmap reference: `Flora_EG_Integration_roadmap.md` US-2.1.1 (in `passbook-flora`).

Flora is registered against En Garde's authorization server
(`EnGardeHQ/engarde-api`, deployed at `https://oauth.engardehq.com`) as a
**first-party** client (`is_first_party: true` — the flag `engarde-api`
reserves for EnGarde-owned apps). The registering superuser account is
**cope@engarde.media** (the En Garde platform super admin — distinct from
cope@passbook.vc, which is the Flora-side identity and has no account in
En Garde's user database).

## Deployment prerequisites (met as of 2026-07-21)

Both required fixes are merged and verified live:

1. **engarde-api** at `https://oauth.engardehq.com` (dedicated subdomain;
   `api.engardehq.com` stays on production-backend, which the En Garde
   frontend depends on) — includes the first-party registration support
   and the completed `/oauth/authorize` SSO flow.
2. **production-backend** — access/refresh tokens now carry the
   `is_superuser` claim engarde-api authorizes from. Tokens minted before
   that deploy never gain the claim, so **log in fresh** before
   registering.

## Getting the superuser JWT

```bash
ENGARDE_SUPERUSER_JWT=$(curl -sS https://api.engarde.media/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "cope@engarde.media", "password": "<password>"}' \
  | jq -r '.access_token')
```

## The registration call

```bash
curl -sS https://oauth.engardehq.com/v1/oauth/clients \
  -X POST \
  -H "Authorization: Bearer $ENGARDE_SUPERUSER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Flora",
    "client_description": "Flora venture OS — native En Garde Marketing Suite integration for GP, Founder, and Admin (GP view) users",
    "redirect_uris": [
      "https://flora.passbook.vc/api/v1/integrations/engarde/callback"
    ],
    "scope": "campaigns:read campaigns:write analytics:read audiences:read assets:read assets:write offline_access",
    "website": "https://flora.passbook.vc",
    "organization_name": "En Garde Inc",
    "email": "cope@engarde.media",
    "is_first_party": true
  }'
```

The response contains `client_id` and `client_secret`. **The secret is
shown exactly once** (only a SHA-256 hash is stored) — capture it
immediately.

## After registration

Set on the `flora-engarde` Railway service (Passbook Flora project):

```
ENGARDE_OAUTH_CLIENT_ID=<client_id from response>
ENGARDE_OAUTH_CLIENT_SECRET=<client_secret from response>
ENGARDE_OAUTH_REDIRECT_URI=https://flora.passbook.vc/api/v1/integrations/engarde/callback
```

## Notes

- **Redirect URI must match exactly** — `engarde-api` validates with an
  exact string match (`OAuthClient.validate_redirect_uri`). If the
  callback route lands on a different path or domain, re-register or
  update the client row before testing the flow.
- **Tenant scoping:** the client row is stored under the registering
  admin's `tenant_id`, but token issuance looks clients up by
  `client_id` alone, so the credential works for grants across all En
  Garde tenants — appropriate for a first-party platform client.
- **PKCE is enforced** (`require_pkce` defaults to true). The
  `flora-engarde` OAuth client must send S256 code challenges — see
  roadmap US-2.1.2.
- **Grant types** issued: `authorization_code`, `client_credentials`,
  `refresh_token`.
