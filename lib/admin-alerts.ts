import { Contact } from "@prisma/client";
import { sendWhatsAppMessage } from "@/lib/whatsapp-sender";
import { prisma } from "@/lib/prisma";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔔 UNIFIED ADMIN ALERT SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This function handles admin alerts for ALL entry points:
 * - WhatsApp messages
 * - Facebook Lead Ads
 * - Manual contact creation
 * - QR code scans
 * - Any other source
 *
 * RULE: Alert admin if:
 * 1. First-ever contact from this phone, OR
 * 2. More than 30 minutes since last inbound message from this contact
 *
 * This function should be called IMMEDIATELY after contact creation/update
 * and BEFORE any AI or flow processing.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export async function checkAndSendAdminAlert({
  contact,
  source,
  adminNumber,
  additionalInfo,
}: {
  contact: Contact;
  source: "whatsapp" | "facebook_lead" | "manual" | "other";
  adminNumber: string;
  additionalInfo?: string;
}): Promise<boolean> {
  if (!adminNumber) {
    console.warn("[ADMIN_ALERT] ADMIN_ALERT_PHONE not set - skipping alert");
    return false;
  }

  console.log("[ADMIN_ALERT] ========================================");
  console.log("[ADMIN_ALERT] Checking if alert should be sent");
  console.log("[ADMIN_ALERT] Contact phone:", contact.phone);
  console.log("[ADMIN_ALERT] Source:", source);
  console.log("[ADMIN_ALERT] Admin number:", adminNumber);

  const THIRTY_MINUTES_MS = 30 * 60 * 1000;

  try {
    // Find the most recent inbound message from this contact across ALL devices
    const lastInboundMessage = await prisma.message.findFirst({
      where: {
        chat: {
          phoneNumber: contact.phone,
        },
        sender: "contact",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const now = new Date();
    let shouldAlert = false;
    let reason = "";

    if (!lastInboundMessage) {
      // First-ever message from this contact
      shouldAlert = true;
      reason = "First-ever contact";
      console.log("[ADMIN_ALERT] ✅ This is the first-ever message from this contact");
    } else {
      // Check time since last message
      const timeSinceLastMessage = now.getTime() - lastInboundMessage.createdAt.getTime();
      const minutesSinceLastMessage = Math.round(timeSinceLastMessage / 1000 / 60);

      console.log(`[ADMIN_ALERT] Last inbound message was ${minutesSinceLastMessage} minutes ago`);
      console.log(`[ADMIN_ALERT] Last message timestamp: ${lastInboundMessage.createdAt.toISOString()}`);
      console.log(`[ADMIN_ALERT] Current timestamp: ${now.toISOString()}`);

      if (timeSinceLastMessage > THIRTY_MINUTES_MS) {
        shouldAlert = true;
        reason = `New session (${minutesSinceLastMessage}min since last message)`;
        console.log(`[ADMIN_ALERT] ✅ Time since last message (${minutesSinceLastMessage}min) exceeds 30-minute threshold`);
      } else {
        shouldAlert = false;
        console.log(`[ADMIN_ALERT] ⏭️ Skipping alert - last message was only ${minutesSinceLastMessage}min ago (< 30min threshold)`);
      }
    }

    if (!shouldAlert) {
      console.log("[ADMIN_ALERT] ========================================");
      return false;
    }

    // Build alert message
    const textLines = [
      "🔔 Nueva conversación en FunnelChat",
      "",
      `• Teléfono: ${contact.phone ?? "Desconocido"}`,
    ];

    if (contact.name) {
      textLines.push(`• Nombre: ${contact.name}`);
    }

    if (contact.email) {
      textLines.push(`• Email: ${contact.email}`);
    }

    const sourceDisplay = {
      whatsapp: "WhatsApp",
      facebook_lead: "Facebook Lead Ads",
      manual: "Manual",
      other: "Otro",
    }[source] || source;

    textLines.push(`• Fuente: ${sourceDisplay}`);
    textLines.push(`• Razón: ${reason}`);

    if (additionalInfo) {
      textLines.push(`• Info: ${additionalInfo}`);
    }

    // Add dashboard link
    const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    if (dashboardUrl) {
      textLines.push("");
      textLines.push(`🔗 Abrir dashboard: ${dashboardUrl}/chat?phone=${encodeURIComponent(contact.phone)}`);
    }

    const alertText = textLines.join("\n");

    console.log(`[ADMIN_ALERT] 🚨 Sending alert to ${adminNumber}`);
    console.log(`[ADMIN_ALERT] Reason: ${reason}`);
    console.log(`[ADMIN_ALERT] Message:`);
    console.log(alertText);

    // Send WhatsApp message to admin
    const result = await sendWhatsAppMessage({
      to: adminNumber,
      message: alertText,
      type: "text",
      text: { body: alertText },
    });

    if (result) {
      console.log(`[ADMIN_ALERT] ✅ Alert sent successfully`);
      console.log("[ADMIN_ALERT] ========================================");
      return true;
    } else {
      console.error(`[ADMIN_ALERT] ❌ Failed to send alert - sendWhatsAppMessage returned false`);
      console.log("[ADMIN_ALERT] ========================================");
      return false;
    }
  } catch (error: any) {
    console.error(`[ADMIN_ALERT_ERROR] ❌ Exception while processing admin alert`);
    console.error(`[ADMIN_ALERT_ERROR] Contact Phone: ${contact.phone}`);
    console.error(`[ADMIN_ALERT_ERROR] Admin Number: ${adminNumber}`);
    console.error(`[ADMIN_ALERT_ERROR] Error Type: ${error?.constructor?.name || typeof error}`);
    console.error(`[ADMIN_ALERT_ERROR] Error Message: ${error?.message || String(error)}`);

    // Log WhatsApp API error response if available
    if (error?.response) {
      console.error(`[ADMIN_ALERT_ERROR] WhatsApp API Response Status: ${error.response.status}`);
      console.error(`[ADMIN_ALERT_ERROR] WhatsApp API Response Body:`, error.response.data || error.response);
    }

    // Log full error object for debugging
    if (error?.stack) {
      console.error(`[ADMIN_ALERT_ERROR] Stack Trace:`, error.stack);
    }

    console.log("[ADMIN_ALERT] ========================================");
    return false;
  }
}
