import { prisma } from "./prisma";

interface SendMessageParams {
  to: string; // Phone number
  message?: string; // For simple text messages (backward compatibility)
  type?: "text" | "interactive" | "image" | "document" | "video" | "audio";
  text?: { body: string };
  interactive?: any; // Interactive message payload (buttons, lists)
  image?: { id?: string; link?: string; caption?: string };
  document?: { id?: string; link?: string; caption?: string; filename?: string };
  video?: { id?: string; link?: string; caption?: string };
  audio?: { id?: string; link?: string };
}

/**
 * Send a WhatsApp message using Cloud API
 * Supports text, interactive (buttons/lists), and media (image/document/video/audio)
 */
export async function sendWhatsAppMessage(params: SendMessageParams): Promise<boolean> {
  const { to, message, type, text, interactive, image, document, video, audio } = params;

  console.log(`[WhatsApp Sender] ========================================`);
  console.log(`[WhatsApp Sender] Sending ${type || 'text'} message to: ${to}`);

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

    // Build request body based on message type
    let requestBody: any = {
      messaging_product: "whatsapp",
      to: formattedPhone,
    };

    // Determine message type and build payload
    if (type === "interactive" && interactive) {
      // Interactive message (buttons, lists)
      requestBody.type = "interactive";
      requestBody.interactive = interactive;
      console.log(`[WhatsApp Sender] Interactive message type: ${interactive.type}`);
    } else if (type === "image" && image) {
      // Image message
      requestBody.type = "image";
      requestBody.image = image;
      console.log(`[WhatsApp Sender] Image: ${image.id || image.link}, caption: ${image.caption || 'none'}`);
    } else if (type === "document" && document) {
      // Document message
      requestBody.type = "document";
      requestBody.document = document;
      console.log(`[WhatsApp Sender] Document: ${document.id || document.link}, filename: ${document.filename || 'none'}`);
    } else if (type === "video" && video) {
      // Video message
      requestBody.type = "video";
      requestBody.video = video;
      console.log(`[WhatsApp Sender] Video: ${video.id || video.link}, caption: ${video.caption || 'none'}`);
    } else if (type === "audio" && audio) {
      // Audio message
      requestBody.type = "audio";
      requestBody.audio = audio;
      console.log(`[WhatsApp Sender] Audio: ${audio.id || audio.link}`);
    } else {
      // Default: text message (backward compatibility)
      requestBody.type = "text";
      requestBody.text = text || { body: message || "" };
      console.log(`[WhatsApp Sender] Text: "${requestBody.text.body}"`);
    }

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
