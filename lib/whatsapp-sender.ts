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
  try {
    // Get WhatsApp configuration from database
    const config = await prisma.whatsAppConfig.findFirst({
      where: {
        mode: "cloud_api",
      },
    });

    if (!config || !config.accessToken || !config.phoneNumberId) {
      console.error("WhatsApp Cloud API not configured");
      return false;
    }

    // Format phone number (remove + and spaces)
    const formattedPhone = to.replace(/[^0-9]/g, "");

    // Send message via WhatsApp Cloud API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: formattedPhone,
          type: "text",
          text: {
            body: message,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to send WhatsApp message:", error);
      return false;
    }

    const data = await response.json();
    console.log("WhatsApp message sent successfully:", data);
    return true;
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    return false;
  }
}
