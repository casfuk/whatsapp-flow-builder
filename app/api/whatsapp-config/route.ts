import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    return NextResponse.json(config);
  } catch (error) {
    console.error("Failed to fetch WhatsApp config:", error);
    return NextResponse.json(
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

    return NextResponse.json(config);
  } catch (error) {
    console.error("Failed to update WhatsApp config:", error);
    return NextResponse.json(
      { error: "Failed to update WhatsApp config" },
      { status: 500 }
    );
  }
}
