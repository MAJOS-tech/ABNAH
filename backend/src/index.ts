export interface Env {
  ZOHO_CLIENT_ID: string;
  ZOHO_CLIENT_SECRET: string;
  ZOHO_ANALYTICS_ORG_ID: string;
  ZOHO_ANALYTICS_WORKSPACE_ID: string;
  FRONTEND_ORIGIN: string;
  ZOHO_ACCOUNTS_URL?: string;
  ZOHO_ANALYTICS_BASE_URL?: string;
}

type ZohoToken = { access_token: string; refresh_token?: string; expires_in?: number };

const SCOPE = "ZohoAnalytics.data.read";
const ACCESS_COOKIE = "abnah_zoho_access";
const REFRESH_COOKIE = "abnah_zoho_refresh";
const STATE_COOKIE = "abnah_zoho_state";

function getCookies(request: Request) {
  return Object.fromEntries((request.headers.get("Cookie") ?? "").split(";").map((part) => {
    const [key, ...value] = part.trim().split("=");
    return [key, decodeURIComponent(value.join("="))];
  }).filter(([key]) => key));
}

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}`;
}

function cors(request: Request, env: Env) {
  const origin = request.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": origin === env.FRONTEND_ORIGIN ? origin : env.FRONTEND_ORIGIN,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  };
}

function json(request: Request, env: Env, body: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(request, env), ...extraHeaders } });
}

function accountsUrl(env: Env) { return env.ZOHO_ACCOUNTS_URL ?? "https://accounts.zoho.in"; }
function analyticsUrl(env: Env) { return env.ZOHO_ANALYTICS_BASE_URL ?? "https://analyticsapi.zoho.com"; }
function redirectUri(url: URL) { return `${url.origin}/auth/zoho/callback`; }

async function refreshToken(env: Env, refresh: string): Promise<ZohoToken> {
  const response = await fetch(`${accountsUrl(env)}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, client_id: env.ZOHO_CLIENT_ID, client_secret: env.ZOHO_CLIENT_SECRET }),
  });
  if (!response.ok) throw new Error("Zoho token refresh failed");
  return response.json() as Promise<ZohoToken>;
}

async function zohoFetch(env: Env, token: string, path: string) {
  return fetch(`${analyticsUrl(env)}${path}`, { headers: { Authorization: `Zoho-oauthtoken ${token}`, "ZANALYTICS-ORGID": env.ZOHO_ANALYTICS_ORG_ID } });
}

async function exportSql(env: Env, token: string, sqlQuery: string) {
  const config = encodeURIComponent(JSON.stringify({ sqlQuery, responseFormat: "csv" }));
  const start = await zohoFetch(env, token, `/restapi/v2/bulk/workspaces/${env.ZOHO_ANALYTICS_WORKSPACE_ID}/data?CONFIG=${config}`);
  if (!start.ok) throw new Error("Zoho export job could not be created");
  const job = await start.json() as { data: { jobId: string } };
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const status = await zohoFetch(env, token, `/restapi/v2/bulk/workspaces/${env.ZOHO_ANALYTICS_WORKSPACE_ID}/exportjobs/${job.data.jobId}`);
    if (!status.ok) throw new Error("Zoho export job status could not be read");
    const result = await status.json() as { data: { jobCode: string } };
    if (result.data.jobCode === "1004") {
      const download = await zohoFetch(env, token, `/restapi/v2/bulk/workspaces/${env.ZOHO_ANALYTICS_WORKSPACE_ID}/exportjobs/${job.data.jobId}/data`);
      if (!download.ok) throw new Error("Zoho export result could not be downloaded");
      return download.text();
    }
    if (result.data.jobCode === "1003" || result.data.jobCode === "1005") throw new Error("Zoho export job failed");
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw new Error("Zoho export timed out");
}

function csvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index], next = csv[index + 1];
    if (char === '"' && quoted && next === '"') { value += char; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value); if (row.some(Boolean)) rows.push(row); row = []; value = "";
    } else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  const [header, ...data] = rows;
  return data.map((cells) => Object.fromEntries(header.map((key, index) => [key.replace(/^\uFEFF/, ""), cells[index] ?? ""])));
}

const QUERIES = {
  outlets: `SELECT "outlet_name" AS "store", ROUND(SUM("net_sales_value"),0) AS "net_sales", ROUND(SUM("menu_gross_margin"),0) AS "gross_margin", ROUND(100.0 * SUM("menu_gross_margin") / NULLIF(SUM("net_sales_value"),0),2) AS "gross_margin_pct" FROM "QT_04_Menu_Profitability" GROUP BY "outlet_name" ORDER BY "gross_margin" DESC`,
  menu: `SELECT "menu_item_name" AS "menu_item", ROUND(SUM("menu_gross_margin"),0) AS "gross_margin", ROUND(100.0 * SUM("menu_gross_margin") / NULLIF(SUM("net_sales_value"),0),2) AS "gross_margin_pct", SUM("sold_menu_qty") AS "qty_sold" FROM "QT_04_Menu_Profitability" GROUP BY "menu_item_name" ORDER BY "gross_margin" DESC LIMIT 12`,
  actions: `SELECT "outlet_name" AS "store", "item_name", "subject_type", "risk_color", ROUND(COALESCE("monetary_exposure",0),0) AS "exposure", ROUND(COALESCE("shortage_qty",0),2) AS "shortage_qty", "po_overdue_days", "impacted_menu_item_count" FROM "QT_02_Numerical_Risk_Center" WHERE "latest_valid_flag"=1 AND "core_complete_flag"=1 AND "subject_type" IN ('INVENTORY','OPEN_PO_TIMING','MENU_IMPACT') AND "risk_color" IN ('Red','Amber') ORDER BY "risk_priority_rank" ASC, COALESCE("monetary_exposure",0) DESC LIMIT 25`,
  variance: `SELECT "outlet_name" AS "store", ROUND(SUM(COALESCE("consumption_leakage_value",0)),0) AS "leakage_value", ROUND(100.0*SUM(COALESCE("actual_consumption_qty",0)-COALESCE("theoretical_consumption_qty",0))/NULLIF(SUM(COALESCE("theoretical_consumption_qty",0)),0),2) AS "variance_pct" FROM "QT_03_Consumption_Variance" GROUP BY "outlet_name" ORDER BY "leakage_value" DESC`,
  procurement: `SELECT "outlet_name" AS "store", "vendor_name", ROUND(SUM(COALESCE("open_po_liability_pre_tax",0)),0) AS "open_liability", MAX("overdue_days") AS "max_overdue_days" FROM "QT_05_Procurement_Control" WHERE "latest_valid_flag"=1 AND "core_complete_flag"=1 AND "po_status" IN ('Open','Partially Received') GROUP BY "outlet_name", "vendor_name" ORDER BY "open_liability" DESC LIMIT 20`,
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(request, env) });
    if (url.pathname === "/health") return json(request, env, { status: "ok" });

    if (url.pathname === "/auth/zoho") {
      const state = crypto.randomUUID();
      const params = new URLSearchParams({ response_type: "code", client_id: env.ZOHO_CLIENT_ID, redirect_uri: redirectUri(url), scope: SCOPE, access_type: "offline", prompt: "consent", state });
      return new Response(null, { status: 302, headers: { Location: `${accountsUrl(env)}/oauth/v2/auth?${params}`, "Set-Cookie": cookie(STATE_COOKIE, state, 600) } });
    }

    if (url.pathname === "/auth/zoho/callback") {
      const cookies = getCookies(request);
      const code = url.searchParams.get("code"), state = url.searchParams.get("state");
      if (!code || !state || state !== cookies[STATE_COOKIE]) return new Response("Invalid Zoho sign-in state", { status: 400 });
      const tokenResponse = await fetch(`${accountsUrl(env)}/oauth/v2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri(url), client_id: env.ZOHO_CLIENT_ID, client_secret: env.ZOHO_CLIENT_SECRET }) });
      if (!tokenResponse.ok) return new Response("Zoho token exchange failed", { status: 502 });
      const token = await tokenResponse.json() as ZohoToken;
      const frontend = new URL(env.FRONTEND_ORIGIN); frontend.searchParams.set("zoho", "connected");
      return new Response(null, { status: 302, headers: { Location: frontend.toString(), "Set-Cookie": [cookie(ACCESS_COOKIE, token.access_token, token.expires_in ?? 3600), cookie(REFRESH_COOKIE, token.refresh_token ?? "", 60 * 60 * 24 * 30), cookie(STATE_COOKIE, "", 0)].join(", ") } });
    }

    if (url.pathname !== "/api/tower") return json(request, env, { message: "Not found" }, 404);
    const cookies = getCookies(request); let token = cookies[ACCESS_COOKIE]; let refreshed: ZohoToken | undefined;
    if (!token && cookies[REFRESH_COOKIE]) { refreshed = await refreshToken(env, cookies[REFRESH_COOKIE]); token = refreshed.access_token; }
    if (!token) return json(request, env, { mode: "unauthenticated", message: "Connect Zoho to retrieve the ABNAH control tower." }, 401);
    try {
      const entries = await Promise.all(Object.entries(QUERIES).map(async ([name, query]) => [name, csvRows(await exportSql(env, token!, query))]));
      const headers: HeadersInit = refreshed ? { "Set-Cookie": cookie(ACCESS_COOKIE, refreshed.access_token, refreshed.expires_in ?? 3600) } : {};
      return json(request, env, { mode: "live", generated_at: new Date().toISOString(), data: Object.fromEntries(entries) }, 200, headers);
    } catch (error) {
      return json(request, env, { mode: "unavailable", message: error instanceof Error ? error.message : "Zoho request failed" }, 502);
    }
  },
};
