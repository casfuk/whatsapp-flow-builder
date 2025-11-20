import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { deviceId, to, message } = await request.json();

    if (!to || !message) {
      return NextResponse.json(
        { error: "Missing required fields: to, message" },
        { status: 400 }
      );
    }

    // Get device configuration
    let device;
    if (deviceId) {
      device = await prisma.device.findUnique({
        where: { id: deviceId },
      });
    } else {
      // Get the first connected device if no deviceId specified
      device = await prisma.device.findFirst({
        where: { isConnected: true },
      });
    }

    if (!device || !device.isConnected) {
      return NextResponse.json(
        { error: "No connected device found" },
        { status: 400 }
      );
    }

    if (!device.whatsappPhoneNumberId || !device.accessToken) {
      return NextResponse.json(
        { error: "Device not properly configured" },
        { status: 400 }
      );
    }

    // Send message via WhatsApp Cloud API
    const whatsappApiUrl = `https://graph.facebook.com/v17.0/${device.whatsappPhoneNumberId}/messages`;

    const response = await fetch(whatsappApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${device.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: {
          preview_url: false,
          body: message,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("WhatsApp API error:", data);
      return NextResponse.json(
        {
          error: "Failed to send message",
          details: data.error?.message || "Unknown error",
        },
        { status: response.status }
      );
    }

    console.log("Message sent successfully:", data);

    return NextResponse.json(
      {
        success: true,
        messageId: data.messages?.[0]?.id,
        deviceId: device.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
