import { NextRequest, NextResponse } from "next/server";

const accountUrl = process.env.ZOHO_ACCOUNTS_URL ?? "https://accounts.zoho.in";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  if (!code || !state || state !== request.cookies.get("abnah_zoho_state")?.value || !clientId || !clientSecret) return NextResponse.redirect(new URL("/?zoho=authorization-failed", request.url));
  const redirectUri = new URL("/api/zoho/callback", request.url).toString();
  const tokenResponse = await fetch(`${accountUrl}/oauth/v2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }) });
  if (!tokenResponse.ok) return NextResponse.redirect(new URL("/?zoho=token-failed", request.url));
  const token = await tokenResponse.json() as { access_token: string; refresh_token?: string; expires_in?: number };
  const response = NextResponse.redirect(new URL("/?zoho=connected", request.url));
  const common = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
  response.cookies.set("abnah_zoho_access", token.access_token, { ...common, maxAge: token.expires_in ?? 3600 });
  if (token.refresh_token) response.cookies.set("abnah_zoho_refresh", token.refresh_token, { ...common, maxAge: 60 * 60 * 24 * 30 });
  response.cookies.delete("abnah_zoho_state");
  return response;
}
