import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/integrations/facebook/oauth/callback
 * Handles Facebook OAuth callback
 * 1. Exchanges authorization code for access token
 * 2. Exchanges short-lived token for long-lived token
 * 3. Fetches user's Facebook pages with page access tokens
 * 4. Stores page integrations in database
 * 5. Auto-discovers leadgen forms for each page
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Handle OAuth errors
    if (error) {
      console.error("[Facebook OAuth] Authorization error:", error, errorDescription);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || ""}/settings/integrations?error=oauth_denied&message=${encodeURIComponent(errorDescription || error)}`
      );
    }

    if (!code) {
      console.error("[Facebook OAuth] No authorization code received");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || ""}/settings/integrations?error=no_code`
      );
    }

    const clientId = process.env.FACEBOOK_OAUTH_APP_ID;
    const clientSecret = process.env.FACEBOOK_OAUTH_APP_SECRET;
    const redirectUri = process.env.FACEBOOK_OAUTH_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error("[Facebook OAuth] Missing required environment variables");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || ""}/settings/integrations?error=config_error`
      );
    }

    console.log("[Facebook OAuth] Exchanging authorization code for access token");

    // Step 1: Exchange code for short-lived user access token
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", clientId);
    tokenUrl.searchParams.set("client_secret", clientSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("[Facebook OAuth] Token exchange failed:", tokenData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || ""}/settings/integrations?error=token_failed&message=${encodeURIComponent(tokenData.error?.message || "Unknown error")}`
      );
    }

    const shortLivedToken = tokenData.access_token;
    console.log("[Facebook OAuth] Short-lived token obtained, exchanging for long-lived token");

    // Step 2: Exchange short-lived token for long-lived token (60 days)
    const longLivedTokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    longLivedTokenUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedTokenUrl.searchParams.set("client_id", clientId);
    longLivedTokenUrl.searchParams.set("client_secret", clientSecret);
    longLivedTokenUrl.searchParams.set("fb_exchange_token", shortLivedToken);

    const longLivedResponse = await fetch(longLivedTokenUrl.toString());
    const longLivedData = await longLivedResponse.json();

    if (!longLivedResponse.ok || !longLivedData.access_token) {
      console.error("[Facebook OAuth] Long-lived token exchange failed:", longLivedData);
      // Fallback to short-lived token if exchange fails
      console.warn("[Facebook OAuth] Falling back to short-lived token");
    }

    const userAccessToken = longLivedData.access_token || shortLivedToken;
    console.log("[Facebook OAuth] Long-lived user access token obtained");

    // Step 3: Fetch user's Facebook pages and their page access tokens
    console.log("[Facebook OAuth] Fetching user's Facebook pages");
    const pagesUrl = new URL("https://graph.facebook.com/v21.0/me/accounts");
    pagesUrl.searchParams.set("access_token", userAccessToken);
    pagesUrl.searchParams.set("fields", "id,name,access_token,category,tasks");

    const pagesResponse = await fetch(pagesUrl.toString());
    const pagesData = await pagesResponse.json();

    if (!pagesResponse.ok || !pagesData.data) {
      console.error("[Facebook OAuth] Failed to fetch pages:", pagesData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || ""}/settings/integrations?error=fetch_pages_failed&message=${encodeURIComponent(pagesData.error?.message || "Unknown error")}`
      );
    }

    const pages = pagesData.data;
    console.log(`[Facebook OAuth] Found ${pages.length} pages`);

    if (pages.length === 0) {
      console.warn("[Facebook OAuth] User has no pages to connect");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || ""}/settings/integrations?error=no_pages&message=${encodeURIComponent("No Facebook pages found. Please create a page first.")}`
      );
    }

    // Step 4: Store page integrations in database
    console.log("[Facebook OAuth] Storing page integrations in database");
    const savedPages = [];

    for (const page of pages) {
      const pageId = page.id;
      const pageName = page.name;
      const pageAccessToken = page.access_token;

      if (!pageAccessToken) {
        console.warn(`[Facebook OAuth] Skipping page ${pageId} - no access token`);
        continue;
      }

      // Step 5: Auto-discover leadgen forms for this page
      console.log(`[Facebook OAuth] Checking for leadgen forms on page ${pageId}`);
      const leadgenFormsUrl = new URL(`https://graph.facebook.com/v21.0/${pageId}/leadgen_forms`);
      leadgenFormsUrl.searchParams.set("access_token", pageAccessToken);
      leadgenFormsUrl.searchParams.set("fields", "id,name,status,leads_count");

      let leadgenForms = [];
      try {
        const leadgenResponse = await fetch(leadgenFormsUrl.toString());
        const leadgenData = await leadgenResponse.json();

        if (leadgenResponse.ok && leadgenData.data) {
          leadgenForms = leadgenData.data;
          console.log(`[Facebook OAuth] Found ${leadgenForms.length} leadgen forms for page ${pageId}`);
        }
      } catch (error) {
        console.error(`[Facebook OAuth] Failed to fetch leadgen forms for page ${pageId}:`, error);
      }

      // Upsert page integration
      const integration = await prisma.facebookPageIntegration.upsert({
        where: { pageId },
        create: {
          pageId,
          pageName,
          pageAccessToken,
          userId: null, // Will be set when user is implemented
        },
        update: {
          pageName,
          pageAccessToken,
          updatedAt: new Date(),
        },
        include: {
          leadFormConfigs: true,
        },
      });

      savedPages.push({
        ...integration,
        leadgenFormsCount: leadgenForms.length,
        leadgenForms: leadgenForms.map((form: any) => ({
          id: form.id,
          name: form.name,
          status: form.status,
          leadsCount: form.leads_count || 0,
        })),
      });

      console.log(`[Facebook OAuth] Saved page integration: ${pageId} - ${pageName}`);
    }

    console.log(`[Facebook OAuth] Successfully connected ${savedPages.length} pages`);

    // Redirect back to integrations page with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || ""}/settings/integrations?success=true&pages=${savedPages.length}`
    );
  } catch (error) {
    console.error("[Facebook OAuth] Unexpected error during callback:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || ""}/settings/integrations?error=unexpected&message=${encodeURIComponent(error instanceof Error ? error.message : "Unknown error")}`
    );
  }
}
