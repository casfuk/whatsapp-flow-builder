import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Get single whalink
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const whalink = await prisma.whalink.findUnique({
      where: { id: params.id },
    });

    if (!whalink) {
      return NextResponse.json({ error: "Whalink not found" }, { status: 404 });
    }

    return NextResponse.json(whalink);
  } catch (error) {
    console.error("Failed to fetch whalink:", error);
    return NextResponse.json({ error: "Failed to fetch whalink" }, { status: 500 });
  }
}

// PUT: Update whalink
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { name, deviceId, presetMessage, image, description, emailKey, nameKey, trackingPixel } = body;

    // Validation
    if (name && name.length > 100) {
      return NextResponse.json({ error: "Name must be max 100 characters" }, { status: 400 });
    }

    if (presetMessage && presetMessage.length > 250) {
      return NextResponse.json({ error: "Message must be max 250 characters" }, { status: 400 });
    }

    const whalink = await prisma.whalink.update({
      where: { id: params.id },
      data: {
        name: name || undefined,
        deviceId: deviceId || undefined,
        presetMessage: presetMessage || undefined,
        image: image !== undefined ? image : undefined,
        description: description !== undefined ? description : undefined,
        emailKey: emailKey !== undefined ? emailKey : undefined,
        nameKey: nameKey !== undefined ? nameKey : undefined,
        trackingPixel: trackingPixel !== undefined ? trackingPixel : undefined,
      },
    });

    return NextResponse.json(whalink);
  } catch (error) {
    console.error("Failed to update whalink:", error);
    return NextResponse.json({ error: "Failed to update whalink" }, { status: 500 });
  }
}

// DELETE: Delete whalink
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.whalink.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete whalink:", error);
    return NextResponse.json({ error: "Failed to delete whalink" }, { status: 500 });
  }
}
