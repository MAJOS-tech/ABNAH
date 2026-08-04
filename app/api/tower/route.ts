import { NextResponse } from "next/server";

/**
 * Secure server-side handoff for Zoho Analytics.
 * Set ZOHO_ANALYTICS_API_URL and ZOHO_ANALYTICS_ACCESS_TOKEN in the host's
 * secret store. Tokens never reach the browser. Until then, the interface
 * deliberately uses its embedded planning preview.
 */
export async function GET() {
  const apiUrl = process.env.ZOHO_ANALYTICS_API_URL;
  const token = process.env.ZOHO_ANALYTICS_ACCESS_TOKEN;
  if (!apiUrl || !token) {
    return NextResponse.json({ mode: "preview", message: "Zoho credentials are not configured." });
  }

  const response = await fetch(apiUrl, {
    headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    return NextResponse.json({ mode: "unavailable", message: "Zoho Analytics could not be reached." }, { status: 502 });
  }
  return NextResponse.json({ mode: "live", data: await response.json() });
}
