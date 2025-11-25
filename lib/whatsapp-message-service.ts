import { prisma } from "./prisma";

interface SendAndPersistMessageParams {
  deviceId: string;
  toPhoneNumber: string;
  type: "text" | "interactive" | "image" | "audio" | "document" | "video";
  payload: any;
  sender: "agent" | "flow" | "contact";
  textPreview?: string;
  chatId?: string;
}

/**
 * Send a WhatsApp message and persist it to the Message table
 * This ensures all outbound messages appear in the chat UI
 */
export async function sendAndPersistMessage(params: SendAndPersistMessageParams): Promise<any> {
  const {
    deviceId,
    toPhoneNumber,
    type,
    payload,
    sender,
    textPreview,
    chatId: providedChatId,
  } = params;

  console.log("[WhatsApp Message Service] Sending and persisting message", {
    deviceId,
    toPhoneNumber,
    type,
    sender,
  });

  // 1) Ensure contact exists
  let contact = await prisma.contact.findFirst({
    where: {
      phone: toPhoneNumber,
      deviceId: deviceId,
    },
  });

  if (!contact) {
    console.log("[WhatsApp Message Service] Contact not found, creating one");
    contact = await prisma.contact.create({
      data: {
        phone: toPhoneNumber,
        deviceId: deviceId,
        name: toPhoneNumber,
        source: "whatsapp",
      },
    });
  }

  // 2) Ensure chat exists
  let chat = providedChatId
    ? await prisma.chat.findUnique({ where: { id: providedChatId } })
    : await prisma.chat.findFirst({
        where: {
          phoneNumber: toPhoneNumber,
          deviceId: deviceId,
        },
        orderBy: { createdAt: "desc" },
      });

  if (!chat) {
    console.log("[WhatsApp Message Service] Chat not found, creating one");
    chat = await prisma.chat.create({
      data: {
        phoneNumber: toPhoneNumber,
        contactName: contact.name,
        deviceId: deviceId,
        status: "open",
        lastMessagePreview: textPreview || "Message",
        lastMessageAt: new Date(),
      },
    });
  }

  // 3) Get WhatsApp config
  const config = await prisma.whatsAppConfig.findFirst({
    where: { mode: "cloud_api" },
  });

  if (!config || !config.accessToken || !config.phoneNumberId) {
    console.error("[WhatsApp Message Service] WhatsApp Cloud API not configured");
    throw new Error("WhatsApp Cloud API not configured");
  }

  // 4) Build request body
  const requestBody = {
    messaging_product: "whatsapp",
    to: toPhoneNumber.replace(/[^0-9]/g, ""),
    type,
    ...payload,
  };

  console.log("[WhatsApp Message Service] Sending to WhatsApp API:", JSON.stringify(requestBody, null, 2));

  // 5) Send via WhatsApp Cloud API
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("[WhatsApp Message Service] WhatsApp API error:", {
      status: response.status,
      statusText: response.statusText,
      data: errorData,
    });
    throw new Error(`WhatsApp API error: ${response.status} ${response.statusText}`);
  }

  const responseData = await response.json();
  const whatsappMessageId = responseData.messages?.[0]?.id;

  console.log("[WhatsApp Message Service] WhatsApp API success:", responseData);

  // 6) Persist in Message table
  await prisma.message.create({
    data: {
      chatId: chat.id,
      sender: sender === "contact" ? "contact" : "agent", // Message model uses "agent" or "contact"
      text: textPreview || payload.text?.body || `[${type}]`,
      status: "sent",
      messageId: whatsappMessageId,
      metadata: JSON.stringify({
        type,
        payload,
        sender,
        sentVia: "flow",
      }),
    },
  });

  // 7) Update chat's last message
  await prisma.chat.update({
    where: { id: chat.id },
    data: {
      lastMessagePreview: textPreview || payload.text?.body || `[${type}]`,
      lastMessageAt: new Date(),
    },
  });

  console.log("[WhatsApp Message Service] ✓ Message sent and persisted");

  return responseData;
}
