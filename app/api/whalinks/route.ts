import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Generate random slug
function generateSlug(length: number = 7): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  for (let i = 0; i < length; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

// GET: List all whalinks
export async function GET() {
  try {
    const whalinks = await prisma.whalink.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(whalinks);
  } catch (error) {
    console.error("Failed to fetch whalinks:", error);
    return NextResponse.json({ error: "Failed to fetch whalinks" }, { status: 500 });
  }
}

// POST: Create new whalink
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, deviceId, presetMessage, image, description, emailKey, nameKey, trackingPixel } = body;

    // Validation
    if (!name || !deviceId || !presetMessage) {
      return NextResponse.json({ error: "Name, device, and message are required" }, { status: 400 });
    }

    if (name.length > 100) {
      return NextResponse.json({ error: "Name must be max 100 characters" }, { status: 400 });
    }

    if (presetMessage.length > 250) {
      return NextResponse.json({ error: "Message must be max 250 characters" }, { status: 400 });
    }

    // Generate unique slug
    let slug = generateSlug();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.whalink.findUnique({ where: { slug } });
      if (!existing) break;
      slug = generateSlug();
      attempts++;
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://wha.link";
    const fullUrl = `${baseUrl}/${slug}`;

    const whalink = await prisma.whalink.create({
      data: {
        name,
        slug,
        fullUrl,
        deviceId,
        presetMessage,
        image: image || null,
        description: description || null,
        emailKey: emailKey || null,
        nameKey: nameKey || null,
        trackingPixel: trackingPixel || null,
      },
    });

    return NextResponse.json(whalink);
  } catch (error) {
    console.error("Failed to create whalink:", error);
    return NextResponse.json({ error: "Failed to create whalink" }, { status: 500 });
  }
}
