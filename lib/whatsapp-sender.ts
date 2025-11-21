import { prisma } from "./prisma";

interface SendMessageParams {
  to: string; // Phone number
  message: string;
}

/**
 * Send a WhatsApp message using Cloud API
 */
export async function sendWhatsAppMessage({
  to,
  message,
}: SendMessageParams): Promise<boolean> {
  console.log(`[WhatsApp Sender] ========================================`);
  console.log(`[WhatsApp Sender] Sending message to: ${to}`);
  console.log(`[WhatsApp Sender] Message: "${message}"`);

  try {
    // Get WhatsApp configuration from database
    const config = await prisma.whatsAppConfig.findFirst({
      where: {
        mode: "cloud_api",
      },
    });

    if (!config || !config.accessToken || !config.phoneNumberId) {
      console.error("[WhatsApp Sender] ERROR: WhatsApp Cloud API not configured");
      console.error("[WhatsApp Sender] Config found:", !!config);
      console.error("[WhatsApp Sender] Has accessToken:", !!config?.accessToken);
      console.error("[WhatsApp Sender] Has phoneNumberId:", !!config?.phoneNumberId);
      return false;
    }

    console.log(`[WhatsApp Sender] Using phoneNumberId: ${config.phoneNumberId}`);

    // Format phone number (remove + and spaces)
    const formattedPhone = to.replace(/[^0-9]/g, "");
    console.log(`[WhatsApp Sender] Formatted phone: ${formattedPhone} (original: ${to})`);

    const requestBody = {
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "text",
      text: {
        body: message,
      },
    };

    console.log(`[WhatsApp Sender] Request body:`, JSON.stringify(requestBody, null, 2));

    // Send message via WhatsApp Cloud API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    console.log(`[WhatsApp Sender] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const error = await response.text();
      console.error("[WhatsApp Sender] WhatsApp API ERROR:", error);
      return false;
    }

    const data = await response.json();
    console.log("[WhatsApp Sender] WhatsApp API response:", JSON.stringify(data, null, 2));
    console.log("[WhatsApp Sender] ✓✓✓ Message sent successfully");
    return true;
  } catch (error) {
    console.error("[WhatsApp Sender] EXCEPTION:", error);
    return false;
  }
}
