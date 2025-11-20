import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.FACEBOOK_CLIENT_ID!;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI!;
  const scopes = "pages_show_list,pages_read_engagement,leads_retrieval";

  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}`;

  return NextResponse.redirect(authUrl);
}
