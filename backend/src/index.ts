export interface Env {
  ZOHO_CLIENT_ID: string;
  ZOHO_CLIENT_SECRET: string;
  ZOHO_ANALYTICS_ORG_ID: string;
  ZOHO_ANALYTICS_WORKSPACE_ID: string;
  FRONTEND_ORIGIN: string;
  FRONTEND_ORIGINS?: string;
  FRONTEND_URL?: string;
  ZOHO_ACCOUNTS_URL?: string;
  ZOHO_ANALYTICS_BASE_URL?: string;
  ZOHO_TOKENS: TokenStore;
  /** Shared secret used only by trusted MAJOSTech service callers. */
  MAJOSTECH_SERVICE_TOKEN?: string;
}

type ZohoToken = { access_token: string; refresh_token?: string; expires_in?: number };
type TokenStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

const SCOPE = "ZohoAnalytics.data.read";
const ACCESS_COOKIE = "abnah_zoho_access";
const REFRESH_COOKIE = "abnah_zoho_refresh";
const STATE_COOKIE = "abnah_zoho_state";
const RETURN_COOKIE = "abnah_zoho_return";
const TOWER_CACHE_KEY = "tower_response_v2";

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function getCookies(request: Request) {
  return Object.fromEntries((request.headers.get("Cookie") ?? "").split(";").map((part) => {
    const [key, ...value] = part.trim().split("=");
    return [key, decodeURIComponent(value.join("="))];
  }).filter(([key]) => key));
}

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}`;
}

function responseWithCookies(location: string, cookies: string[]) {
  const headers = new Headers({ Location: location });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(null, { status: 302, headers });
}

function allowedOrigins(env: Env) {
  return (env.FRONTEND_ORIGINS ?? env.FRONTEND_ORIGIN)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function approvedFrontend(request: Request, env: Env) {
  const fallback = new URL(env.FRONTEND_URL ?? env.FRONTEND_ORIGIN);
  const candidate = new URL(request.url).searchParams.get("return_to") ?? request.headers.get("Referer");
  if (!candidate) return fallback;
  try {
    const target = new URL(candidate);
    return allowedOrigins(env).includes(target.origin) ? target : fallback;
  } catch {
    return fallback;
  }
}

function cors(request: Request, env: Env) {
  const origin = request.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  };
  if (origin && allowedOrigins(env).includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(request: Request, env: Env, body: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(request, env), ...extraHeaders } });
}

function accountsUrl(env: Env) { return env.ZOHO_ACCOUNTS_URL ?? "https://accounts.zoho.in"; }
function analyticsUrl(env: Env) { return env.ZOHO_ANALYTICS_BASE_URL ?? "https://analyticsapi.zoho.com"; }
function redirectUri(url: URL) { return `${url.origin}/auth/zoho/callback`; }

function serviceJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function serviceAuthorised(request: Request, env: Env) {
  const expected = env.MAJOSTECH_SERVICE_TOKEN;
  const received = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !received || expected.length !== received.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ received.charCodeAt(index);
  return mismatch === 0;
}

async function sharedAccessToken(env: Env) {
  const refresh = await env.ZOHO_TOKENS.get("refresh_token");
  if (!refresh) throw new Error("Zoho shared connection is not ready");
  return (await refreshToken(env, refresh)).access_token;
}

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
  let job: { data: { jobId: string } } | undefined;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const start = await zohoFetch(env, token, `/restapi/v2/bulk/workspaces/${env.ZOHO_ANALYTICS_WORKSPACE_ID}/data?CONFIG=${config}`);
    if (start.ok) {
      job = await start.json() as { data: { jobId: string } };
      break;
    }
    const detail = await start.text();
    if (start.status === 400 && detail.includes("ASYNC_EXPORT_LIMIT_EXCEEDED")) {
      await delay(1200 * (attempt + 1));
      continue;
    }
    throw new Error(`Zoho export job could not be created (${start.status}): ${detail.slice(0, 500)}`);
  }
  if (!job) throw new Error("Zoho export queue is busy. Please retry in a few seconds.");
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = await zohoFetch(env, token, `/restapi/v2/bulk/workspaces/${env.ZOHO_ANALYTICS_WORKSPACE_ID}/exportjobs/${job.data.jobId}`);
    if (!status.ok) throw new Error("Zoho export job status could not be read");
    const result = await status.json() as { data: { jobCode: string } };
    if (result.data.jobCode === "1004") {
      const download = await zohoFetch(env, token, `/restapi/v2/bulk/workspaces/${env.ZOHO_ANALYTICS_WORKSPACE_ID}/exportjobs/${job.data.jobId}/data`);
      if (!download.ok) throw new Error("Zoho export result could not be downloaded");
      return download.text();
    }
    if (result.data.jobCode === "1003" || result.data.jobCode === "1005") throw new Error("Zoho export job failed");
    await delay(800);
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
  menu: `SELECT "outlet_name" AS "store", "menu_item_name" AS "menu_item", ROUND(SUM("net_sales_value"),0) AS "net_sales", ROUND(SUM("menu_gross_margin"),0) AS "gross_margin", ROUND(100.0 * SUM("menu_gross_margin") / NULLIF(SUM("net_sales_value"),0),2) AS "gross_margin_pct", SUM("sold_menu_qty") AS "qty_sold" FROM "QT_04_Menu_Profitability" GROUP BY "outlet_name", "menu_item_name" ORDER BY "gross_margin" DESC LIMIT 300`,
  actions: `SELECT "outlet_name" AS "store", "item_name", "subject_type", "risk_color", ROUND(COALESCE("monetary_exposure",0),0) AS "exposure", ROUND(COALESCE("shortage_qty",0),2) AS "shortage_qty", "po_overdue_days", "impacted_menu_item_count" FROM "QT_02_Numerical_Risk_Center" WHERE "latest_valid_flag"=1 AND "core_complete_flag"=1 AND "subject_type" IN ('INVENTORY','OPEN_PO_TIMING','MENU_IMPACT') AND "risk_color" IN ('Red','Amber') ORDER BY "risk_priority_rank" ASC, COALESCE("monetary_exposure",0) DESC LIMIT 25`,
  variance: `SELECT "outlet_name" AS "store", ROUND(SUM(COALESCE("consumption_leakage_value",0)),0) AS "leakage_value", ROUND(100.0*SUM(COALESCE("actual_consumption_qty",0)-COALESCE("theoretical_consumption_qty",0))/NULLIF(SUM(COALESCE("theoretical_consumption_qty",0)),0),2) AS "variance_pct" FROM "QT_03_Consumption_Variance" GROUP BY "outlet_name" ORDER BY "leakage_value" DESC`,
  procurement: `SELECT "outlet_name" AS "store", "vendor_name", ROUND(SUM(COALESCE("open_po_liability_pre_tax",0)),0) AS "open_liability", MAX("overdue_days") AS "max_overdue_days" FROM "QT_05_Procurement_Control" WHERE "latest_valid_flag"=1 AND "core_complete_flag"=1 AND "po_status" IN ('Open','Partially Received') GROUP BY "outlet_name", "vendor_name" ORDER BY "open_liability" DESC LIMIT 20`,
  recipe: `SELECT "menu_item_name", "ingredient_name", ROUND("canonical_qty_per_menu_unit",3) AS "qty_per_menu_unit", "canonical_uom" FROM "ZIA_QT_03_Recipe_Canonical" ORDER BY "menu_item_name", "ingredient_name" LIMIT 1500`,
  vendorTrace: `SELECT "menu_item_name", "ingredient_name", "outlet_name" AS "store", "vendor_name", "po_number", ROUND("vendor_open_po_liability_pre_tax",0) AS "open_liability", ROUND("vendor_overdue_open_po_liability_pre_tax",0) AS "overdue_liability", "overdue_days", "risk_color" FROM "ZIA_QT_04_Menu_Vendor_Dependency" WHERE "latest_valid_flag"=1 ORDER BY "menu_item_name", "ingredient_name", "overdue_days" DESC LIMIT 1500`,
};

type ReplenishmentRisk = {
  outlet: string;
  ingredient: string;
  subjectType: string;
  severity: string;
  exposure: string;
  shortageQuantity: string;
  overdueDays: string;
  impactedMenuItemCount: string;
};

function normaliseRisk(row: Record<string, string>): ReplenishmentRisk {
  return {
    outlet: row.store,
    ingredient: row.item_name,
    subjectType: row.subject_type,
    severity: row.risk_color,
    exposure: row.exposure,
    shortageQuantity: row.shortage_qty,
    overdueDays: row.po_overdue_days,
    impactedMenuItemCount: row.impacted_menu_item_count,
  };
}

async function replenishmentRisks(request: Request, env: Env) {
  const url = new URL(request.url);
  const outlet = url.searchParams.get("outlet")?.trim().toLowerCase();
  const ingredient = url.searchParams.get("ingredient")?.trim().toLowerCase();
  const token = await sharedAccessToken(env);
  const rows = csvRows(await exportSql(env, token, QUERIES.actions));
  const risks = rows
    .map(normaliseRisk)
    .filter((risk) => (!outlet || risk.outlet.toLowerCase().includes(outlet)) && (!ingredient || risk.ingredient.toLowerCase().includes(ingredient)));
  return serviceJson({ generatedAt: new Date().toISOString(), risks });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(request, env) });
    if (url.pathname === "/health") return json(request, env, { status: "ok" });

    if (url.pathname === "/internal/replenishment-risks") {
      if (request.method !== "GET") return serviceJson({ message: "Method not allowed" }, 405);
      if (!serviceAuthorised(request, env)) return serviceJson({ message: "Unauthorised" }, 401);
      try {
        return await replenishmentRisks(request, env);
      } catch (error) {
        console.error("Trusted replenishment-risk export failed", error);
        return serviceJson({ message: "Replenishment risks are temporarily unavailable" }, 502);
      }
    }

    if (url.pathname === "/auth/zoho") {
      const frontend = approvedFrontend(request, env);
      if (await env.ZOHO_TOKENS.get("refresh_token")) {
        frontend.searchParams.set("zoho", "shared");
        return new Response(null, { status: 302, headers: { Location: frontend.toString() } });
      }
      const state = crypto.randomUUID();
      const params = new URLSearchParams({ response_type: "code", client_id: env.ZOHO_CLIENT_ID, redirect_uri: redirectUri(url), scope: SCOPE, access_type: "offline", prompt: "consent", state });
      return responseWithCookies(`${accountsUrl(env)}/oauth/v2/auth?${params}`, [
        cookie(STATE_COOKIE, state, 600),
        cookie(RETURN_COOKIE, frontend.toString(), 600),
      ]);
    }

    if (url.pathname === "/auth/zoho/callback") {
      const cookies = getCookies(request);
      const code = url.searchParams.get("code"), state = url.searchParams.get("state");
      if (!code || !state || state !== cookies[STATE_COOKIE]) return new Response("Invalid Zoho sign-in state", { status: 400 });
      const tokenResponse = await fetch(`${accountsUrl(env)}/oauth/v2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri(url), client_id: env.ZOHO_CLIENT_ID, client_secret: env.ZOHO_CLIENT_SECRET }) });
      if (!tokenResponse.ok) return new Response("Zoho token exchange failed", { status: 502 });
      const token = await tokenResponse.json() as ZohoToken;
      if (!token.refresh_token) return new Response("Zoho did not return an offline refresh token", { status: 502 });
      await env.ZOHO_TOKENS.put("refresh_token", token.refresh_token);
      const frontend = approvedFrontend(new Request(`${url.origin}/auth/zoho?return_to=${encodeURIComponent(cookies[RETURN_COOKIE] ?? "")}`), env);
      frontend.searchParams.set("zoho", "connected");
      return responseWithCookies(frontend.toString(), [
        cookie(ACCESS_COOKIE, token.access_token, token.expires_in ?? 3600),
        cookie(REFRESH_COOKIE, token.refresh_token ?? "", 60 * 60 * 24 * 30),
        cookie(STATE_COOKIE, "", 0),
        cookie(RETURN_COOKIE, "", 0),
      ]);
    }

    if (url.pathname !== "/api/tower") return json(request, env, { message: "Not found" }, 404);
    const cookies = getCookies(request); let token = cookies[ACCESS_COOKIE]; let refreshed: ZohoToken | undefined;
    const sharedRefresh = await env.ZOHO_TOKENS.get("refresh_token");
    const refresh = cookies[REFRESH_COOKIE] ?? sharedRefresh;
    if (!token && refresh) { refreshed = await refreshToken(env, refresh); token = refreshed.access_token; }
    if (!token) return json(request, env, { mode: "unauthenticated", message: "Connect Zoho to retrieve the ABNAH control tower." }, 401);
    try {
      const cached = await env.ZOHO_TOKENS.get(TOWER_CACHE_KEY);
      if (cached) return json(request, env, JSON.parse(cached));

      const entries: Array<[string, Record<string, string>[]]> = [];
      for (const [name, query] of Object.entries(QUERIES)) {
        try {
          entries.push([name, csvRows(await exportSql(env, token, query))]);
        } catch (error) {
          throw new Error(`${name}: ${error instanceof Error ? error.message : "Zoho export failed"}`);
        }
        await delay(250);
      }
      const headers: HeadersInit = refreshed ? { "Set-Cookie": cookie(ACCESS_COOKIE, refreshed.access_token, refreshed.expires_in ?? 3600) } : {};
      const payload = { mode: "live", generated_at: new Date().toISOString(), data: Object.fromEntries(entries) };
      await env.ZOHO_TOKENS.put(TOWER_CACHE_KEY, JSON.stringify(payload), { expirationTtl: 60 });
      return json(request, env, payload, 200, headers);
    } catch (error) {
      console.error("Zoho tower export failed", error);
      return json(request, env, { mode: "unavailable", message: error instanceof Error ? error.message : "Zoho request failed" }, 502);
    }
  },
};
