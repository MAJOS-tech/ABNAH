# ABNAH Zoho API backend

This Cloudflare Worker is the secure backend for the ABNAH Supply Chain Tower front end. It keeps the Zoho client secret and refresh token server-side, exposes only read-only ABNAH control-tower data, and never sends Zoho credentials to the browser.

## Required environment values

- `ZOHO_CLIENT_ID` - secret
- `ZOHO_CLIENT_SECRET` - secret
- `MAJOSTECH_SERVICE_TOKEN` - secret shared only with the MAJOSTech WhatsApp-agent Worker
- `ZOHO_ANALYTICS_ORG_ID=60026100833`
- `ZOHO_ANALYTICS_WORKSPACE_ID=333330000004099001`
- `FRONTEND_ORIGIN=https://abnahsct.majostech.com` (default origin)
- `FRONTEND_ORIGINS=https://abnahsct.majostech.com,https://majos-tech.github.io` (approved browser origins)
- `FRONTEND_URL=https://abnahsct.majostech.com/` (default OAuth return page)

Optional India defaults are in `.dev.vars.example`.

## OAuth redirect URL

After deploying the Worker, use this redirect URI in the Zoho API Console:

`https://YOUR-WORKER.workers.dev/auth/zoho/callback`

## Browser endpoints

- `GET /health`
- `GET /auth/zoho`
- `GET /api/tower`
- `GET /internal/replenishment-risks` — trusted service endpoint; requires `Authorization: Bearer <MAJOSTECH_SERVICE_TOKEN>`

The Worker reads only the approved ABNAH query views: profitability, risk center, consumption variance and procurement control.

## MAJOSTech service interface

`GET /internal/replenishment-risks` is for the reusable MAJOSTech WhatsApp-agent connector, not browser clients. It requires the `MAJOSTECH_SERVICE_TOKEN` bearer token and returns an allow-listed, read-only replenishment-risk schema. Optional `outlet` and `ingredient` query parameters filter the response. Keep this token in Cloudflare Worker secrets in both services; never put it in browser code, the repository, or WhatsApp messages.

The browser-facing `/api/tower` endpoint remains unchanged and continues to use the existing CORS and Zoho-login flow.

## Dual frontend behavior

Both the branded domain and the GitHub Pages project URL may call the API with credentials. OAuth validates the requested return page against `FRONTEND_ORIGINS`; unapproved return addresses fall back to `FRONTEND_URL`. Do not replace the allowlist with a wildcard because credentialed CORS requires an explicit approved origin.
