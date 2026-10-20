import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJson } from "@/lib/safe-response";

// GET: Get single whalink
export async function GET(request: NextRequest, context: any) {
  const { id } = await context.params;

  try {
    const whalink = await prisma.whalink.findUnique({
      where: { id },
    });

    if (!whalink) {
      return safeJson({ error: "Whalink not found" }, { status: 404 });
    }

    return safeJson(whalink);
  } catch (error) {
    console.error("Failed to fetch whalink:", error);
    return safeJson({ error: "Failed to fetch whalink" }, { status: 500 });
  }
}

// PUT: Update whalink
export async function PUT(request: NextRequest, context: any) {
  const { id } = await context.params;

  try {
    const body = await request.json();
    const { name, deviceId, presetMessage, image, description, emailKey, nameKey, trackingPixel } = body;

    // Validation
    if (name && name.length > 100) {
      return safeJson({ error: "Name must be max 100 characters" }, { status: 400 });
    }

    if (presetMessage && presetMessage.length > 250) {
      return safeJson({ error: "Message must be max 250 characters" }, { status: 400 });
    }

    const whalink = await prisma.whalink.update({
      where: { id },
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

    return safeJson(whalink);
  } catch (error) {
    console.error("Failed to update whalink:", error);
    return safeJson({ error: "Failed to update whalink" }, { status: 500 });
  }
}

// DELETE: Delete whalink
export async function DELETE(request: NextRequest, context: any) {
  const { id } = await context.params;

  try {
    await prisma.whalink.delete({
      where: { id },
    });

    return safeJson({ success: true });
  } catch (error) {
    console.error("Failed to delete whalink:", error);
    return safeJson({ error: "Failed to delete whalink" }, { status: 500 });
  }
}
