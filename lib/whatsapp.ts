/**
 * Centralized WhatsApp messaging utility
 * Use this function throughout the app to send WhatsApp messages
 */

interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  details?: string;
}

/**
 * Send a WhatsApp message using a specific device or the default connected device
 * @param to - Recipient phone number (international format, e.g., "34644412937")
 * @param text - Message text content
 * @param deviceId - Optional device ID. If not provided, uses the first connected device
 * @returns Promise with result containing success status and message ID or error
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string,
  deviceId?: string
): Promise<SendMessageResult> {
  try {
    const response = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deviceId,
        to,
        message: text,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Failed to send message",
        details: data.details,
      };
    }

    return {
      success: true,
      messageId: data.messageId,
    };
  } catch (error) {
    console.error("sendWhatsAppMessage error:", error);
    return {
      success: false,
      error: "Network error or internal failure",
    };
  }
}

/**
 * Format phone number to WhatsApp format (remove + and spaces)
 * @param phoneNumber - Phone number in any format
 * @returns Formatted phone number (digits only)
 */
export function formatPhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/[^\d]/g, "");
}

/**
 * Validate WhatsApp phone number format
 * @param phoneNumber - Phone number to validate
 * @returns true if valid, false otherwise
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  const formatted = formatPhoneNumber(phoneNumber);
  // International phone numbers are typically 7-15 digits
  return formatted.length >= 7 && formatted.length <= 15;
}

/**
 * Simple server-side WhatsApp sender for webhooks
 * @param phone - Recipient phone number
 * @param message - Message text
 */
export async function sendWhatsApp(phone: string, message: string) {
  // Use Cloud API if configured, otherwise log
  if (process.env.WHATSAPP_CLOUD_API_TOKEN) {
    return sendWhatsAppTextMessage(phone, message);
  }
  console.log(`[WhatsApp] Sending to ${phone}: ${message}`);
  return { success: true };
}

/**
 * Send text message via WhatsApp Cloud API
 */
export async function sendWhatsAppTextMessage(to: string, body: string) {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.error("WhatsApp Cloud API credentials missing");
    return { success: false, error: "Missing credentials" };
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const requestBody = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    };

    console.log("[lib/whatsapp] ========================================");
    console.log("[lib/whatsapp] 🚀 SENDING TEXT MESSAGE TO WHATSAPP CLOUD API");
    console.log("[lib/whatsapp] URL:", url);
    console.log("[lib/whatsapp] Method: POST");
    console.log("[lib/whatsapp] Headers:", {
      Authorization: `Bearer ${token.substring(0, 10)}...${token.substring(token.length - 4)}`,
      "Content-Type": "application/json",
    });
    console.log("[lib/whatsapp] Body:", JSON.stringify(requestBody, null, 2));
    console.log("[lib/whatsapp] ========================================");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log("[lib/whatsapp] ========================================");
    console.log("[lib/whatsapp] 📥 WHATSAPP CLOUD API RESPONSE");
    console.log("[lib/whatsapp] Status:", res.status, res.statusText);
    console.log("[lib/whatsapp] Headers:", Object.fromEntries(res.headers.entries()));

    const data = await res.json();
    console.log("[lib/whatsapp] Response body:", JSON.stringify(data, null, 2));

    if (!res.ok) {
      console.error("[lib/whatsapp] ❌ WhatsApp send error:", data);
      console.log("[lib/whatsapp] ========================================");
      return { success: false, error: data.error?.message };
    }

    console.log("[lib/whatsapp] ✅ Message sent successfully");
    console.log("[lib/whatsapp] Message ID:", data.messages?.[0]?.id);
    console.log("[lib/whatsapp] ========================================");
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error) {
    console.error("[lib/whatsapp] ❌ EXCEPTION - WhatsApp send failed:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send template message via WhatsApp Cloud API
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  langCode: string = "es",
  components?: any[]
) {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.error("WhatsApp Cloud API credentials missing");
    return { success: false, error: "Missing credentials" };
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const requestBody = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: langCode },
        components: components || [],
      },
    };

    console.log("[lib/whatsapp] ========================================");
    console.log("[lib/whatsapp] 🚀 SENDING TEMPLATE MESSAGE TO WHATSAPP CLOUD API");
    console.log("[lib/whatsapp] URL:", url);
    console.log("[lib/whatsapp] Method: POST");
    console.log("[lib/whatsapp] Headers:", {
      Authorization: `Bearer ${token.substring(0, 10)}...${token.substring(token.length - 4)}`,
      "Content-Type": "application/json",
    });
    console.log("[lib/whatsapp] Body:", JSON.stringify(requestBody, null, 2));
    console.log("[lib/whatsapp] ========================================");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log("[lib/whatsapp] ========================================");
    console.log("[lib/whatsapp] 📥 WHATSAPP CLOUD API RESPONSE");
    console.log("[lib/whatsapp] Status:", res.status, res.statusText);
    console.log("[lib/whatsapp] Headers:", Object.fromEntries(res.headers.entries()));

    const data = await res.json();
    console.log("[lib/whatsapp] Response body:", JSON.stringify(data, null, 2));

    if (!res.ok) {
      console.error("[lib/whatsapp] ❌ WhatsApp template error:", data);
      console.log("[lib/whatsapp] ========================================");
      return { success: false, error: data.error?.message };
    }

    console.log("[lib/whatsapp] ✅ Template sent successfully");
    console.log("[lib/whatsapp] Message ID:", data.messages?.[0]?.id);
    console.log("[lib/whatsapp] ========================================");
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error) {
    console.error("[lib/whatsapp] ❌ EXCEPTION - WhatsApp template failed:", error);
    return { success: false, error: String(error) };
  }
}
