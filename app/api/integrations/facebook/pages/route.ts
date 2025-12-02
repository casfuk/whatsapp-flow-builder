import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/integrations/facebook/pages
 * Returns the connected Facebook page integration (if any)
 */
export async function GET(request: NextRequest) {
  try {
    const integration = await prisma.facebookPageIntegration.findFirst({
      include: {
        leadFormConfigs: true,
      },
    });

    if (!integration) {
      return NextResponse.json({ integration: null });
    }

    return NextResponse.json({ integration });
  } catch (error) {
    console.error("Failed to fetch Facebook integration:", error);
    return NextResponse.json(
      { error: "Failed to fetch integration" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/integrations/facebook/pages
 * Connect a Facebook page
 * Body: { pageId, pageName, pageAccessToken, userId? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pageId, pageName, pageAccessToken, userId } = body;

    if (!pageId || !pageName || !pageAccessToken) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create or update the page integration
    const integration = await prisma.facebookPageIntegration.upsert({
      where: { pageId },
      create: {
        pageId,
        pageName,
        pageAccessToken,
        userId: userId || null,
      },
      update: {
        pageName,
        pageAccessToken,
        userId: userId || undefined,
        updatedAt: new Date(),
      },
      include: {
        leadFormConfigs: true,
      },
    });

    return NextResponse.json({ integration }, { status: 201 });
  } catch (error) {
    console.error("Failed to connect Facebook page:", error);
    return NextResponse.json(
      { error: "Failed to connect page" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/facebook/pages
 * Disconnect the Facebook page integration
 */
export async function DELETE(request: NextRequest) {
  try {
    // Delete the integration (cascade will delete configs)
    await prisma.facebookPageIntegration.deleteMany({});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to disconnect Facebook page:", error);
    return NextResponse.json(
      { error: "Failed to disconnect page" },
      { status: 500 }
    );
  }
}
