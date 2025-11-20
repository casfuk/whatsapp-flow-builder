import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, email, ...rest } = body;

    if (!phone) {
      return NextResponse.json({ error: "Phone required" }, { status: 400 });
    }

    // Save lead
    const lead = await prisma.lead.upsert({
      where: { phone },
      create: { name, phone, email, metadata: JSON.stringify(rest) },
      update: { name, email, metadata: JSON.stringify(rest) },
    });

    // Send WhatsApp message
    const message = `Hola ${name || "amigo"}, gracias por registrarte!`;
    await sendWhatsApp(phone, message);

    // Log message
    await prisma.messageLog.create({
      data: { phone, message, status: "sent" },
    });

    return NextResponse.json({ success: true, leadId: lead.id });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
