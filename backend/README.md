# ABNAH Zoho API backend

This Cloudflare Worker is the secure backend for the ABNAH Supply Chain Tower front end. It keeps the Zoho client secret and refresh token server-side, exposes only read-only ABNAH control-tower data, and never sends Zoho credentials to the browser.

## Required environment values

- `ZOHO_CLIENT_ID` - secret
- `ZOHO_CLIENT_SECRET` - secret
- `ZOHO_ANALYTICS_ORG_ID=60026100833`
- `ZOHO_ANALYTICS_WORKSPACE_ID=333330000004099001`
- `FRONTEND_ORIGIN=https://abnahsct.majostech.com`
- `FRONTEND_URL=https://abnahsct.majostech.com/`

Optional India defaults are in `.dev.vars.example`.

## OAuth redirect URL

After deploying the Worker, use this redirect URI in the Zoho API Console:

`https://YOUR-WORKER.workers.dev/auth/zoho/callback`

## Browser endpoints

- `GET /health`
- `GET /auth/zoho`
- `GET /api/tower`

The Worker reads only the approved ABNAH query views: profitability, risk center, consumption variance and procurement control.
