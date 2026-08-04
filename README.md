# ABNAH Supply Chain Tower

An action-led planning cockpit for ABNAH cafés. It turns inventory, purchase
orders, supplier performance, recipes and forecasted menu demand into a daily
replenishment decision queue.

## What the tower answers

- Which ingredient shortages threaten the most gross margin?
- Which outlet needs action today, and which supplier should be followed up?
- Which menu items are exposed by an ingredient shortage?
- Where is spend concentrated across vendors and categories?

## Zoho Analytics connection

The interface is intentionally safe to publish before credentials exist. It
shows a planning preview until a server-side Zoho Analytics endpoint and access
token are configured in the hosting provider's secret store.

1. Copy `.env.example` to `.env.local` for local development.
2. Configure `ZOHO_ANALYTICS_API_URL` with the approved query/export endpoint.
3. Configure `ZOHO_ANALYTICS_ACCESS_TOKEN` only as a hosted secret; never put
   it in browser code or commit it to this repository.

The `/api/tower` route acts as the server-only integration boundary. It returns
the live Zoho response once the secrets are configured, while the dashboard can
remain safely usable in preview mode.

## Development

```bash
npm run dev
npm run build
```
