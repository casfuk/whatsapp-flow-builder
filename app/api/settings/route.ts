import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: 1 },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: 1 },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { whatsappNumber, defaultAgent } = body;

    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: {
        whatsappNumber: whatsappNumber ?? undefined,
        defaultAgent: defaultAgent ?? undefined,
      },
      create: {
        id: 1,
        whatsappNumber,
        defaultAgent,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
