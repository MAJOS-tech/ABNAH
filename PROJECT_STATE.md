# Project State

## Current production topology

- Front end: GitHub Pages at `https://abnahsct.majostech.com`
- API: Cloudflare Worker at `https://abnah-zoho-api.techmajos6.workers.dev`
- Data source: Zoho Analytics through server-side OAuth
- Source of truth: `MAJOS-tech/ABNAH`

## 2026-08-15

- Added the GitHub Pages custom domain `abnahsct.majostech.com`.
- Updated the API Worker frontend origin and OAuth return URL to the custom domain.
- The legacy `https://majos-tech.github.io/ABNAH/` address remains a Pages routing alias but is not an authorized browser origin for live data.
- Added an explicit dual-origin CORS allowlist for the branded domain and GitHub Pages origin.
- Added validated OAuth return routing so users return to whichever approved frontend initiated login.
- GitHub Pages deployment completed successfully (run 31865200218).
- Worker deployment and live authenticated-data validation remain required after this configuration change.

## 2026-08-19

- Added a branch-scoped trusted `GET /internal/replenishment-risks` interface for the MAJOSTech reusable WhatsApp-agent connector.
- The endpoint is read-only, token-authenticated, and returns only an allow-listed risk schema from the existing `actions` query.
- The existing browser `/api/tower` route remains unchanged.
- Before deployment, set the same `MAJOSTECH_SERVICE_TOKEN` as a Cloudflare secret in this Worker and the WhatsApp-agent Worker, then validate the live Zoho connection and service-to-service request.
