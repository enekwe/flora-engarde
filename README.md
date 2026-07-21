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

Scaffold only (Epoch 1). Routes, OAuth flow, and proxy controllers are not
yet implemented — see the roadmap doc for sequencing. `GET /health` is the
only live endpoint today.

## Local development

```bash
npm install
cp .env.example .env   # fill in ENGARDE_OAUTH_CLIENT_ID/SECRET once registered
npm run dev
```

## Deployment

Deploys to Railway as its own service (like Flora's other microservices).
`railway.json` + `Dockerfile` follow `FLORA_DEVELOPMENT_RULES.md`: no
`EXPOSE`/`HEALTHCHECK` in the Dockerfile, `PORT` is Railway-injected and
fails fast in production if missing.

This repo needs to be added to the Railway project as a service manually —
that step is not automated by this scaffold.
