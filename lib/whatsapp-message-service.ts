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
  console.log("[WhatsApp Config Debug] ========================================");
  console.log("[WhatsApp Config Debug] 🔍 CHECKING WHATSAPP CONFIGURATION");

  const config = await prisma.whatsAppConfig.findFirst({
    where: { mode: "cloud_api" },
  });

  console.log("[WhatsApp Config Debug] Database config:", {
    found: !!config,
    hasAccessToken: !!config?.accessToken,
    hasPhoneNumberId: !!config?.phoneNumberId,
    mode: config?.mode,
    accessTokenLength: config?.accessToken?.length,
    phoneNumberId: config?.phoneNumberId,
  });

  console.log("[WhatsApp Config Debug] Environment variables:", {
    hasVerifyToken: !!process.env.WHATSAPP_VERIFY_TOKEN,
    hasAccessToken: !!process.env.WHATSAPP_ACCESS_TOKEN,
    hasCloudApiToken: !!process.env.WHATSAPP_CLOUD_API_TOKEN,
    hasBusinessId: !!process.env.WHATSAPP_BUSINESS_ID,
    hasPhoneNumberId: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
  });
  console.log("[WhatsApp Config Debug] ========================================");

  if (!config || !config.accessToken || !config.phoneNumberId) {
    console.error("[WhatsApp Config Debug] ❌ Database config is INCOMPLETE");
    console.error("[WhatsApp Config Debug] Config object:", config);
    console.error("[WhatsApp Message Service] WhatsApp Cloud API not configured");
    throw new Error("WhatsApp Cloud API not configured");
  }

  console.log("[WhatsApp Config Debug] ✅ Database config is VALID");

  // 4) Build request body
  const requestBody = {
    messaging_product: "whatsapp",
    to: toPhoneNumber.replace(/[^0-9]/g, ""),
    type,
    ...payload,
  };

  console.log("[WhatsApp Message Service] Sending to WhatsApp API:", JSON.stringify(requestBody, null, 2));

  // Log full request details (with sanitized token)
  const apiUrl = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;
  console.log("[WhatsApp Message Service] ========================================");
  console.log("[WhatsApp Message Service] 🚀 SENDING REQUEST TO WHATSAPP CLOUD API");
  console.log("[WhatsApp Message Service] URL:", apiUrl);
  console.log("[WhatsApp Message Service] Method: POST");
  console.log("[WhatsApp Message Service] Headers:", {
    Authorization: `Bearer ${config.accessToken.substring(0, 10)}...${config.accessToken.substring(config.accessToken.length - 4)}`,
    "Content-Type": "application/json",
  });
  console.log("[WhatsApp Message Service] Body:", JSON.stringify(requestBody, null, 2));
  console.log("[WhatsApp Message Service] ========================================");

  // 5) Send via WhatsApp Cloud API
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  // Log response details
  console.log("[WhatsApp Message Service] ========================================");
  console.log("[WhatsApp Message Service] 📥 WHATSAPP CLOUD API RESPONSE");
  console.log("[WhatsApp Message Service] Status:", response.status, response.statusText);
  console.log("[WhatsApp Message Service] Headers:", Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    // Try to parse error as JSON first, fall back to text
    let errorData;
    const contentType = response.headers.get("content-type");

    try {
      if (contentType && contentType.includes("application/json")) {
        errorData = await response.json();
        console.error("[WhatsApp Message Service] ❌ ERROR Response (JSON):", JSON.stringify(errorData, null, 2));
      } else {
        errorData = await response.text();
        console.error("[WhatsApp Message Service] ❌ ERROR Response (Text):", errorData);
      }
    } catch (parseError) {
      console.error("[WhatsApp Message Service] ❌ Could not parse error response:", parseError);
      errorData = {};
    }

    console.error("[WhatsApp Message Service] ❌ REQUEST FAILED");
    console.error("[WhatsApp Message Service] Failed request details:", {
      url: apiUrl,
      deviceId,
      type: requestBody.type,
      to: requestBody.to,
      hasMediaId: !!(requestBody.image?.id || requestBody.document?.id || requestBody.audio?.id || requestBody.video?.id),
      hasMediaLink: !!(requestBody.image?.link || requestBody.document?.link || requestBody.audio?.link || requestBody.video?.link),
      payload: requestBody,
    });
    console.log("[WhatsApp Message Service] ========================================");

    throw new Error(`WhatsApp API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
  }

  const responseData = await response.json();
  const whatsappMessageId = responseData.messages?.[0]?.id;

  console.log("[WhatsApp Message Service] ✅ SUCCESS Response:", JSON.stringify(responseData, null, 2));
  console.log("[WhatsApp Message Service] Message ID:", whatsappMessageId || "N/A");
  console.log("[WhatsApp Message Service] ========================================");

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
