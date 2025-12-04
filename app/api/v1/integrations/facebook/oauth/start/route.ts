import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/integrations/facebook/oauth/start
 * Initiates Facebook OAuth flow for page integration
 * Redirects user to Facebook authorization page
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.FACEBOOK_OAUTH_APP_ID;
    const redirectUri = process.env.FACEBOOK_OAUTH_REDIRECT_URI;
    const scopes = process.env.FACEBOOK_OAUTH_SCOPES || "pages_show_list,pages_read_engagement,pages_manage_metadata,leads_retrieval,business_management";

    if (!clientId || !redirectUri) {
      console.error("[Facebook OAuth] Missing required environment variables");
      return NextResponse.json(
        { error: "OAuth configuration is incomplete" },
        { status: 500 }
      );
    }

    // Construct Facebook OAuth URL
    const authUrl = new URL("https://www.facebook.com/v18.0/dialog/oauth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("response_type", "code");

    console.log("[Facebook OAuth] Redirecting to Facebook authorization:", authUrl.toString());

    // Redirect user to Facebook
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("[Facebook OAuth] Failed to initiate OAuth flow:", error);
    return NextResponse.json(
      { error: "Failed to initiate OAuth flow" },
      { status: 500 }
    );
  }
}
