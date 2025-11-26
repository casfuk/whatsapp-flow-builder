import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Create or update a third-party trigger
 *
 * POST /api/third-party-triggers
 * Body: { flowId, deviceId, type?, title?, triggerId? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { flowId, deviceId, type = "facebook_lead", title, triggerId } = body;

    console.log("[Third-Party Triggers API] POST request:", {
      flowId,
      deviceId,
      type,
      title,
      triggerId,
    });

    // Validate required fields
    if (!flowId || !deviceId) {
      return NextResponse.json(
        { error: "Missing flowId or deviceId" },
        { status: 400 }
      );
    }

    // If triggerId is provided, update existing trigger
    if (triggerId) {
      const updatedTrigger = await prisma.thirdPartyTrigger.update({
        where: { id: triggerId },
        data: {
          flowId,
          deviceId,
          type,
          title: title || null,
          updatedAt: new Date(),
        },
      });

      console.log("[Third-Party Triggers API] Trigger updated:", updatedTrigger.id);

      return NextResponse.json({
        triggerId: updatedTrigger.id,
        webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://flows-api.funnelchat.app"}/api/v1/integrations/${updatedTrigger.id}/webhook`,
      });
    }

    // Otherwise, create new trigger
    const newTrigger = await prisma.thirdPartyTrigger.create({
      data: {
        flowId,
        deviceId,
        type,
        title: title || null,
        fieldMapping: JSON.stringify({}),
      },
    });

    console.log("[Third-Party Triggers API] Trigger created:", newTrigger.id);

    return NextResponse.json({
      triggerId: newTrigger.id,
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://flows-api.funnelchat.app"}/api/v1/integrations/${newTrigger.id}/webhook`,
    });
  } catch (error: any) {
    console.error("[Third-Party Triggers API] Error:", error);
    return NextResponse.json(
      { error: "Internal error", message: error.message },
      { status: 500 }
    );
  }
}
