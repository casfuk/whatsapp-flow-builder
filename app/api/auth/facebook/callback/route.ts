import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect("/settings/integrations?error=no_code");
  }

  const clientId = process.env.FACEBOOK_CLIENT_ID!;
  const clientSecret = process.env.FACEBOOK_CLIENT_SECRET!;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI!;

  // Exchange code for access token
  const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${clientSecret}&code=${code}`;
  const tokenRes = await fetch(tokenUrl);
  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    return NextResponse.redirect("/settings/integrations?error=token_failed");
  }

  const accessToken = tokenData.access_token;
  const expiresIn = tokenData.expires_in; // seconds

  // Get Facebook user info
  const meRes = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${accessToken}`);
  const meData = await meRes.json();

  // Save FacebookAccount
  await prisma.facebookAccount.upsert({
    where: { facebookUserId: meData.id },
    create: {
      facebookUserId: meData.id,
      accessToken,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
    },
    update: {
      accessToken,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
    },
  });

  // Fetch Pages
  const pagesRes = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`);
  const pagesData = await pagesRes.json();

  for (const page of pagesData.data || []) {
    await prisma.facebookPageConnection.upsert({
      where: { pageId: page.id },
      create: {
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
      },
      update: {
        pageName: page.name,
        pageAccessToken: page.access_token,
      },
    });
  }

  return NextResponse.redirect("/settings/integrations?success=true");
}
