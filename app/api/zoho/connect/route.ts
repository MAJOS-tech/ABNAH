import { NextResponse } from "next/server";

const accountUrl = process.env.ZOHO_ACCOUNTS_URL ?? "https://accounts.zoho.in";

export async function GET(request: Request) {
  const clientId = process.env.ZOHO_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(new URL("/?zoho=not-configured", request.url));
  const state = crypto.randomUUID();
  const redirectUri = new URL("/api/zoho/callback", request.url).toString();
  const params = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, scope: "ZohoAnalytics.data.read", access_type: "offline", prompt: "consent", state });
  const response = NextResponse.redirect(`${accountUrl}/oauth/v2/auth?${params}`);
  response.cookies.set("abnah_zoho_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}
