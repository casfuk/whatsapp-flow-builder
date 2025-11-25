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
    const requestBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: "text",
      text: {
        preview_url: false,
        body: message,
      },
    };

    console.log("[/api/whatsapp/send] ========================================");
    console.log("[/api/whatsapp/send] 🚀 SENDING MESSAGE TO WHATSAPP CLOUD API");
    console.log("[/api/whatsapp/send] URL:", whatsappApiUrl);
    console.log("[/api/whatsapp/send] Device ID:", device.id);
    console.log("[/api/whatsapp/send] Method: POST");
    console.log("[/api/whatsapp/send] Headers:", {
      Authorization: `Bearer ${device.accessToken.substring(0, 10)}...${device.accessToken.substring(device.accessToken.length - 4)}`,
      "Content-Type": "application/json",
    });
    console.log("[/api/whatsapp/send] Body:", JSON.stringify(requestBody, null, 2));
    console.log("[/api/whatsapp/send] ========================================");

    const response = await fetch(whatsappApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${device.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log("[/api/whatsapp/send] ========================================");
    console.log("[/api/whatsapp/send] 📥 WHATSAPP CLOUD API RESPONSE");
    console.log("[/api/whatsapp/send] Status:", response.status, response.statusText);
    console.log("[/api/whatsapp/send] Headers:", Object.fromEntries(response.headers.entries()));

    const data = await response.json();
    console.log("[/api/whatsapp/send] Response body:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error("[/api/whatsapp/send] ❌ WhatsApp API error:", data);
      console.log("[/api/whatsapp/send] ========================================");
      return NextResponse.json(
        {
          error: "Failed to send message",
          details: data.error?.message || "Unknown error",
        },
        { status: response.status }
      );
    }

    console.log("[/api/whatsapp/send] ✅ Message sent successfully:", data);
    console.log("[/api/whatsapp/send] Message ID:", data.messages?.[0]?.id);
    console.log("[/api/whatsapp/send] ========================================");

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
