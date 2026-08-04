import { NextRequest, NextResponse } from "next/server";

/**
 * Secure server-side handoff for Zoho Analytics.
 * Set ZOHO_ANALYTICS_API_URL and ZOHO_ANALYTICS_ACCESS_TOKEN in the host's
 * secret store. Tokens never reach the browser. Until then, the interface
 * deliberately uses its embedded planning preview.
 */
export async function GET(request: NextRequest) {
  const apiUrl = process.env.ZOHO_ANALYTICS_API_URL;
  const token = request.cookies.get("abnah_zoho_access")?.value ?? process.env.ZOHO_ANALYTICS_ACCESS_TOKEN;
  if (!apiUrl || !token) {
    return NextResponse.json({ mode: "preview", message: "Connect Zoho Analytics to load your live tower." });
  }

  let activeToken = token;
  let response = await fetch(apiUrl, {
    headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  let renewed: { access_token: string; expires_in?: number } | null = null;
  const refreshToken = request.cookies.get("abnah_zoho_refresh")?.value;
  if (response.status === 401 && refreshToken && process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET) {
    const refreshResponse = await fetch(`${process.env.ZOHO_ACCOUNTS_URL ?? "https://accounts.zoho.in"}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: process.env.ZOHO_CLIENT_ID, client_secret: process.env.ZOHO_CLIENT_SECRET }),
    });
    if (refreshResponse.ok) {
      renewed = await refreshResponse.json() as { access_token: string; expires_in?: number };
      activeToken = renewed.access_token;
      response = await fetch(apiUrl, { headers: { Authorization: `Zoho-oauthtoken ${activeToken}`, Accept: "application/json" }, cache: "no-store" });
    }
  }
  if (!response.ok) {
    return NextResponse.json({ mode: "unavailable", message: "Zoho Analytics could not be reached." }, { status: 502 });
  }
  const result = NextResponse.json({ mode: "live", source: "Zoho Analytics", data: await response.json() });
  if (renewed) result.cookies.set("abnah_zoho_access", renewed.access_token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: renewed.expires_in ?? 3600 });
  return result;
}
