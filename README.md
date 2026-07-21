# Flora ⨯ En Garde

Flora microservice that bridges GP, Founder, and Admin (GP view) users to the
**En Garde Marketing Suite** — natively, not via iframe.

This service is a git submodule of [`passbook-flora`](https://github.com/enekwe/passbook-flora)
at `microservices/flora-engarde`, following the same pattern as
`flora-mercury-service`, `flora-captable-fund`, and Flora's other microservices.

Full plan: see `Flora_EG_Integration_roadmap.md` in the `passbook-flora` root
for the epoch/epic/user-story breakdown this scaffold implements against.

## What this is

An Express service that will own:

1. **OAuth 2.0 + PKCE bridge** to [`EnGardeHQ/engarde-api`](https://github.com/EnGardeHQ/engarde-api)
   (En Garde's own OAuth authorization server + API gateway), so Flora never
   holds a shared static secret — each GP/fund tenant gets its own token grant.
2. **A proxy/sync layer** over En Garde's public API v1 (`campaigns`,
   `audiences`, `assets`, `analytics`) so Flora's frontend calls Flora's own
   API, not En Garde's directly.
3. **Fund/tenant scoping** so a GP only ever sees their own En Garde
   workspace data — no cross-tenant leakage, matching Flora's existing
   `gpFundScopeMiddleware` pattern.

## Status

**Epochs 2 (Auth & Identity Bridge) and 3 (Backend Proxy & Data Sync) are
implemented** and unit-tested. Epoch 4 (native Flora frontend pages +
sidebar entry) is next — see the roadmap doc for sequencing.

### Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | none | Liveness |
| `GET` | `/api/v1/engarde/oauth/authorize/start` | Flora JWT | Begin connect: mint PKCE + state, redirect to En Garde consent |
| `GET` | `/api/v1/engarde/oauth/callback` | state param | Exchange code → store encrypted per-fund tokens → return to Flora |
| `GET` | `/api/v1/engarde/oauth/status` | Flora JWT | Is this fund connected? |
| `DELETE` | `/api/v1/engarde/oauth/connection` | Flora JWT | Revoke at En Garde (RFC 7009) + delete locally |
| `GET/POST` | `/api/v1/engarde/campaigns` | Flora JWT + fund | List / create campaigns |
| `GET/PATCH/DELETE` | `/api/v1/engarde/campaigns/:id` | Flora JWT + fund | Read / update / delete a campaign |
| `GET` | `/api/v1/engarde/audiences[/:id]` | Flora JWT + fund | List / read audiences |
| `GET` | `/api/v1/engarde/assets[/:id]` | Flora JWT + fund | List / read assets |
| `GET` | `/api/v1/engarde/analytics/dashboard` | Flora JWT + fund | Aggregated dashboard metrics |
| `GET` | `/api/v1/engarde/analytics/campaigns/:id/metrics` | Flora JWT + fund | Per-campaign metrics |

Callers are authenticated by their **Flora session JWT** (shared
`JWT_SECRET`); only `gp`, `admin`, and `portfolio_company` roles are
admitted, matching the sidebar's GP-view exposure. En Garde tokens are
stored **AES-256-GCM encrypted, one connection per fund**
(`EngardeConnection`); the PKCE `code_verifier` is held server-side in a
short-lived TTL record (`EngardeOAuthState`) and never sent to the browser.

The proxy layer resolves the caller's **own fund** token from their signed
JWT (never a request parameter), so a GP/Founder can only reach their own
fund's En Garde data. Access tokens are **auto-refreshed** on demand; if a
token is expired and unrefreshable the proxy returns `401
engarde_reconnect_required`, and an unconnected fund returns `409
engarde_not_connected` — both are signals the frontend uses to show the
connect CTA.

## Local development

```bash
npm install
cp .env.example .env   # fill in ENGARDE_OAUTH_CLIENT_ID/SECRET (see docs/ENGARDE_CLIENT_REGISTRATION.md),
                       # JWT_SECRET (shared with the Flora monolith), and ENCRYPTION_KEY (openssl rand -hex 32)
npm run dev
npm test               # jest: PKCE, encryption, route/auth guards
```

## Deployment

Deploys to Railway as its own service (like Flora's other microservices).
`railway.json` + `Dockerfile` follow `FLORA_DEVELOPMENT_RULES.md`: no
`EXPOSE`/`HEALTHCHECK` in the Dockerfile, `PORT` is Railway-injected and
fails fast in production if missing.

This repo needs to be added to the Railway project as a service manually —
that step is not automated by this scaffold.
