import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJson } from "@/lib/safe-response";

type WhatsAppConfigRecord = Awaited<ReturnType<typeof prisma.whatsAppConfig.findFirst>>;

// Never send credentials or session data to the browser
function toPublicConfig(config: NonNullable<WhatsAppConfigRecord>) {
  const { accessToken, sessionState, ...rest } = config;
  return { ...rest, hasAccessToken: !!accessToken, hasSessionState: !!sessionState };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId") || null;

    let config = await prisma.whatsAppConfig.findFirst({
      where: { workspaceId },
    });

    if (!config) {
      config = await prisma.whatsAppConfig.create({
        data: {
          workspaceId,
          mode: "cloud_api",
        },
      });
    }

    return safeJson(toPublicConfig(config));
  } catch (error) {
    console.error("Failed to fetch WhatsApp config:", error);
    return safeJson(
      { error: "Failed to fetch WhatsApp config" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, mode, phoneNumber, phoneNumberId, wabaId, accessToken } = body;

    const config = await prisma.whatsAppConfig.upsert({
      where: {
        id: body.id || "new",
      },
      update: {
        mode,
        phoneNumber,
        phoneNumberId,
        wabaId,
        accessToken,
      },
      create: {
        workspaceId: workspaceId || null,
        mode: mode || "cloud_api",
        phoneNumber,
        phoneNumberId,
        wabaId,
        accessToken,
      },
    });

    return safeJson(toPublicConfig(config));
  } catch (error) {
    console.error("Failed to update WhatsApp config:", error);
    return safeJson(
      { error: "Failed to update WhatsApp config" },
      { status: 500 }
    );
  }
}
