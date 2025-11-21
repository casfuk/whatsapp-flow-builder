import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  try {
    const whalink = await prisma.whalink.findUnique({
      where: { slug: slug },
    });

    if (!whalink) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    // Get device phone number
    const device = await prisma.device.findUnique({
      where: { id: whalink.deviceId },
    });

    if (!device || !device.phoneNumber) {
      return NextResponse.json({ error: "Device not found or not configured" }, { status: 404 });
    }

    // Clean phone number: remove +, spaces, and any non-digits
    const cleanPhone = device.phoneNumber.replace(/[^\d]/g, "");

    // Build WhatsApp API URL (not wa.me)
    const encodedMessage = encodeURIComponent(whalink.presetMessage);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`;

    console.log(`[WhaLink Redirect] ${params.slug} → ${whatsappUrl}`);

    // Redirect
    return NextResponse.redirect(whatsappUrl);
  } catch (error) {
    console.error("Redirect error:", error);
    return NextResponse.json({ error: "Redirect failed" }, { status: 500 });
  }
}
