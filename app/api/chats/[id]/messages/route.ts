import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Fetch messages for this chat
    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" },
      take: limit,
      skip: offset,
    });

    // Get total count for pagination
    const total = await prisma.message.count({
      where: { chatId },
    });

    // Format response
    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      chatId: msg.chatId,
      sender: msg.sender,
      text: msg.text,
      status: msg.status,
      messageId: msg.messageId,
      metadata: msg.metadata ? JSON.parse(msg.metadata) : {},
      createdAt: msg.createdAt.toISOString(),
    }));

    return NextResponse.json({
      messages: formattedMessages,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Failed to fetch messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatId } = await params;
    const body = await request.json();
    const { text } = body;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "Message text is required" },
        { status: 400 }
      );
    }

    // Get the chat to retrieve phone number and device
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Get device details
    const device = await prisma.device.findUnique({
      where: { id: chat.deviceId },
    });

    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    // Send WhatsApp message via the WhatsApp API
    // This assumes you have a WhatsApp Cloud API setup or similar
    let whatsappMessageId = null;
    let messageStatus = "sent";

    try {
      // Call WhatsApp API to send message
      const whatsappApiUrl = `https://graph.facebook.com/v18.0/${device.whatsappPhoneNumberId}/messages`;
      const requestBody = {
        messaging_product: "whatsapp",
        to: chat.phoneNumber,
        type: "text",
        text: { body: text },
      };

      console.log("[/api/chats/[id]/messages] ========================================");
      console.log("[/api/chats/[id]/messages] 🚀 SENDING MESSAGE TO WHATSAPP CLOUD API");
      console.log("[/api/chats/[id]/messages] URL:", whatsappApiUrl);
      console.log("[/api/chats/[id]/messages] Chat ID:", chatId);
      console.log("[/api/chats/[id]/messages] Device ID:", device.id);
      console.log("[/api/chats/[id]/messages] Method: POST");
      console.log("[/api/chats/[id]/messages] Headers:", {
        Authorization: `Bearer ${device.accessToken.substring(0, 10)}...${device.accessToken.substring(device.accessToken.length - 4)}`,
        "Content-Type": "application/json",
      });
      console.log("[/api/chats/[id]/messages] Body:", JSON.stringify(requestBody, null, 2));
      console.log("[/api/chats/[id]/messages] ========================================");

      const whatsappResponse = await fetch(whatsappApiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${device.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("[/api/chats/[id]/messages] ========================================");
      console.log("[/api/chats/[id]/messages] 📥 WHATSAPP CLOUD API RESPONSE");
      console.log("[/api/chats/[id]/messages] Status:", whatsappResponse.status, whatsappResponse.statusText);
      console.log("[/api/chats/[id]/messages] Headers:", Object.fromEntries(whatsappResponse.headers.entries()));

      if (whatsappResponse.ok) {
        const data = await whatsappResponse.json();
        console.log("[/api/chats/[id]/messages] ✅ Response body:", JSON.stringify(data, null, 2));
        whatsappMessageId = data.messages?.[0]?.id || null;
        console.log("[/api/chats/[id]/messages] Message ID:", whatsappMessageId);
      } else {
        const errorText = await whatsappResponse.text();
        console.error("[/api/chats/[id]/messages] ❌ WhatsApp API error:", errorText);
        messageStatus = "failed";
      }
      console.log("[/api/chats/[id]/messages] ========================================");
    } catch (whatsappError) {
      console.error("[/api/chats/[id]/messages] ❌ EXCEPTION - Failed to send WhatsApp message:", whatsappError);
      messageStatus = "failed";
    }

    // Save message to database
    const message = await prisma.message.create({
      data: {
        chatId,
        sender: "agent",
        text,
        status: messageStatus,
        messageId: whatsappMessageId,
      },
    });

    // Update chat's last message info
    await prisma.chat.update({
      where: { id: chatId },
      data: {
        lastMessagePreview: text,
        lastMessageAt: new Date(),
      },
    });

    // Format response
    const formattedMessage = {
      id: message.id,
      chatId: message.chatId,
      sender: message.sender,
      text: message.text,
      status: message.status,
      messageId: message.messageId,
      metadata: message.metadata ? JSON.parse(message.metadata) : {},
      createdAt: message.createdAt.toISOString(),
    };

    return NextResponse.json(formattedMessage, { status: 201 });
  } catch (error) {
    console.error("Failed to send message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
