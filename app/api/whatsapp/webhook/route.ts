import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runFlowForIncomingMessage } from "@/lib/flowEngine";

// GET endpoint for webhook verification (Meta setup)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    console.log("Webhook verified successfully");
    return new NextResponse(challenge, { status: 200 });
  } else {
    console.error("Webhook verification failed");
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 403 }
    );
  }
}

// POST endpoint for receiving messages from WhatsApp
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("Incoming webhook:", JSON.stringify(body, null, 2));

    // Check if this is a message event
    if (body.object === "whatsapp_business_account") {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (value?.messages) {
        const message = value.messages[0];
        const from = message.from; // Phone number
        const messageId = message.id;
        const messageBody = message.text?.body || "";
        const messageType = message.type;

        console.log(`Message from ${from}: ${messageBody}`);

        // Get device ID from the webhook payload (WhatsApp Phone Number ID)
        const devicePhoneNumberId = value.metadata?.phone_number_id;

        // Find device by whatsappPhoneNumberId
        let device = null;
        if (devicePhoneNumberId) {
          device = await prisma.device.findFirst({
            where: { whatsappPhoneNumberId: devicePhoneNumberId },
          });
        }

        // If no device found, use the first connected device as fallback
        if (!device) {
          device = await prisma.device.findFirst({
            where: { isConnected: true },
            orderBy: { createdAt: 'asc' },
          });
        }

        const deviceId = device?.id || "";

        // Save or update contact (using composite unique key: phone + deviceId)
        await prisma.contact.upsert({
          where: {
            phone_device: {
              phone: from,
              deviceId: deviceId,
            },
          },
          create: {
            phone: from,
            deviceId: deviceId,
            name: value.contacts?.[0]?.profile?.name || null,
            source: "whatsapp",
            metadata: JSON.stringify({
              lastMessageAt: new Date().toISOString(),
              lastMessageId: messageId,
            }),
          },
          update: {
            name: value.contacts?.[0]?.profile?.name || undefined,
            metadata: JSON.stringify({
              lastMessageAt: new Date().toISOString(),
              lastMessageId: messageId,
            }),
            updatedAt: new Date(),
          },
        });

        console.log(`Contact ${from} saved/updated successfully (deviceId: ${deviceId})`);

        // Run flow engine for incoming message
        if (messageType === "text" && messageBody) {
          await runFlowForIncomingMessage({ from, text: messageBody });
        }
      }

      // Handle status updates (message delivered, read, etc.)
      if (value?.statuses) {
        const status = value.statuses[0];
        console.log(
          `Message ${status.id} status: ${status.status}`
        );
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
