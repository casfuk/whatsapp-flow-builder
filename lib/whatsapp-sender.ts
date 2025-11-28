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
  console.log(`[WhatsApp Sender] Params:`, JSON.stringify({
    to,
    message: message?.substring(0, 50),
    type,
    hasText: !!text,
    hasInteractive: !!interactive,
    hasImage: !!image
  }));

  try {
    // Get WhatsApp configuration from database, fallback to env vars
    let config = await prisma.whatsAppConfig.findFirst({
      where: {
        mode: "cloud_api",
      },
    });

    // Fallback to environment variables if DB config is missing
    if (!config || !config.accessToken || !config.phoneNumberId) {
      console.log("[WhatsApp Sender] Database config incomplete, using environment variables");

      const envAccessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_CLOUD_API_TOKEN;
      const envPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

      if (!envAccessToken || !envPhoneNumberId) {
        console.error("[WhatsApp Sender] ERROR: WhatsApp Cloud API not configured");
        console.error("[WhatsApp Sender] Config found:", !!config);
        console.error("[WhatsApp Sender] ENV access token:", !!envAccessToken);
        console.error("[WhatsApp Sender] ENV phone number ID:", !!envPhoneNumberId);
        return false;
      }

      // Use env vars as config
      config = {
        id: "env-fallback",
        mode: "cloud_api",
        accessToken: envAccessToken,
        phoneNumberId: envPhoneNumberId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      console.log("[WhatsApp Sender] ✅ Using environment variables as config");
    }

    // Final validation
    if (!config || !config.accessToken || !config.phoneNumberId) {
      console.error("[WhatsApp Sender] ERROR: Config validation failed after fallback");
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
      if (text && typeof text === "object" && text.body) {
        requestBody.text = text;
      } else {
        requestBody.text = { body: message || "" };
      }
      console.log(`[WhatsApp Sender] Text: "${requestBody.text.body}"`);
    }

    console.log(`[WhatsApp Sender] Request body:`, JSON.stringify(requestBody, null, 2));

    // Log full request details (with sanitized token)
    const apiUrl = `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`;
    console.log(`[WhatsApp Sender] ========================================`);
    console.log(`[WhatsApp Sender] 🚀 SENDING REQUEST TO WHATSAPP CLOUD API`);
    console.log(`[WhatsApp Sender] URL: ${apiUrl}`);
    console.log(`[WhatsApp Sender] Method: POST`);
    console.log(`[WhatsApp Sender] Headers:`, {
      Authorization: `Bearer ${config.accessToken.substring(0, 10)}...${config.accessToken.substring(config.accessToken.length - 4)}`,
      "Content-Type": "application/json",
    });
    console.log(`[WhatsApp Sender] Body:`, JSON.stringify(requestBody, null, 2));
    console.log(`[WhatsApp Sender] ========================================`);

    // Send message via WhatsApp Cloud API
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    // Log response details
    console.log(`[WhatsApp Sender] ========================================`);
    console.log(`[WhatsApp Sender] 📥 WHATSAPP CLOUD API RESPONSE`);
    console.log(`[WhatsApp Sender] Status: ${response.status} ${response.statusText}`);
    console.log(`[WhatsApp Sender] Headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      // Try to parse error as JSON first, fall back to text
      let errorBody;
      const contentType = response.headers.get("content-type");

      try {
        if (contentType && contentType.includes("application/json")) {
          errorBody = await response.json();
          console.error("[WhatsApp Sender] ❌ ERROR Response (JSON):", JSON.stringify(errorBody, null, 2));
        } else {
          errorBody = await response.text();
          console.error("[WhatsApp Sender] ❌ ERROR Response (Text):", errorBody);
        }
      } catch (parseError) {
        console.error("[WhatsApp Sender] ❌ Could not parse error response:", parseError);
      }

      console.error("[WhatsApp Sender] ❌ REQUEST FAILED");
      console.error("[WhatsApp Sender] Failed request details:", {
        url: apiUrl,
        type: requestBody.type,
        to: requestBody.to,
        hasMediaId: !!(requestBody.image?.id || requestBody.document?.id || requestBody.audio?.id || requestBody.video?.id),
        hasMediaLink: !!(requestBody.image?.link || requestBody.document?.link || requestBody.audio?.link || requestBody.video?.link),
      });
      console.log(`[WhatsApp Sender] ========================================`);
      return false;
    }

    const data = await response.json();
    console.log("[WhatsApp Sender] ✅ SUCCESS Response:", JSON.stringify(data, null, 2));
    console.log("[WhatsApp Sender] Message ID:", data.messages?.[0]?.id || "N/A");
    console.log("[WhatsApp Sender] ✓✓✓ Message sent successfully");
    console.log(`[WhatsApp Sender] ========================================`);
    return true;
  } catch (error) {
    console.error("[WhatsApp Sender] EXCEPTION:", error);
    return false;
  }
}

/**
 * Send notification to owner when a new conversation starts
 * @param from - User phone number
 * @param lastMessage - Last incoming text
 * @param chatId - Optional internal chat ID
 */
export async function sendOwnerNotification(opts: {
  from: string;
  lastMessage: string;
  chatId?: string;
}): Promise<boolean> {
  try {
    const ownerNumber = process.env.OWNER_WHATSAPP_NUMBER;
    const baseUrl = process.env.APP_BASE_URL;

    if (!ownerNumber) {
      console.warn("[Notifications] OWNER_WHATSAPP_NUMBER not set, skipping owner notification");
      return false;
    }

    const safeMessage = (opts.lastMessage || "").slice(0, 200); // prevent crazy long messages

    // Build dashboard URL
    const dashboardUrl = baseUrl
      ? `${baseUrl}/chat?phone=${encodeURIComponent(opts.from)}`
      : "";

    const bodyLines = [
      "📩 Nueva conversación en FunnelChat",
      `De: +${opts.from}`,
      `Mensaje: "${safeMessage}"`,
    ];

    if (dashboardUrl) {
      bodyLines.push(`Haz clic aquí para abrir el dashboard 🔗 ${dashboardUrl}`);
    }

    const text = bodyLines.join("\n");

    console.log(`[Notifications] Owner notified about new message from ${opts.from}`);

    // Reuse existing WhatsApp send function
    const sent = await sendWhatsAppMessage({
      to: ownerNumber,
      message: text,
      type: "text",
    });

    if (!sent) {
      console.error("[Notifications] ❌ Failed to send notification to owner");
    }

    return sent;
  } catch (error) {
    console.error("[Notifications] ❌ Exception while sending notification:", error);
    return false;
  }
}

/**
 * 🌐 UNIVERSAL HANDOVER NOTIFICATION SYSTEM
 *
 * Send handover summary to supervisor when ANY AI agent conversation ends.
 * This function is agent-agnostic and works for ALL agents (ClaudIA, MarIA, future agents).
 *
 * @param handoverData - Parsed JSON object with conversation data (or fallback object if parsing failed)
 * @param clientPhone - The client's phone number
 * @param agentName - Optional name of the AI agent (for display in notification)
 * @returns Promise<boolean> - true if notification was sent successfully
 */
export async function sendHandoverNotification(
  handoverData: Record<string, any>,
  clientPhone: string,
  agentName?: string
): Promise<boolean> {
  try {
    const supervisorNumber = "34644412937"; // David (Admin) - receives ALL AI agent HANDOVER notifications
    const baseUrl = process.env.APP_BASE_URL;

    console.log("[Handover] ========================================");
    console.log("[Handover] Supervisor number in use:", supervisorNumber);
    console.log("[Handover] Supervisor number length:", supervisorNumber.length);
    console.log("[Handover] Supervisor number format check:", {
      value: supervisorNumber,
      hasPlus: supervisorNumber.includes('+'),
      hasSpaces: supervisorNumber.includes(' '),
      isNumericOnly: /^\d+$/.test(supervisorNumber),
      expectedLength: supervisorNumber.length === 11
    });
    console.log(`[Handover] Sending supervisor summary to ${supervisorNumber} (David)`);
    console.log(`[Handover] Agent: ${agentName || 'Unknown'}`);
    console.log("[Handover] Handover data:", handoverData);
    console.log("[Handover] Client phone:", clientPhone);

    // ═══════════════════════════════════════════════════════════════════════════
    // 🔄 UNIVERSAL BULLET POINT GENERATION
    // ═══════════════════════════════════════════════════════════════════════════
    // This works for ALL agents by dynamically extracting fields from the JSON.
    // Common fields are prioritized, but ANY field from ANY agent will be included.
    // ═══════════════════════════════════════════════════════════════════════════

    const bulletPoints: string[] = [];

    // Check if this is an error/fallback handover
    const isErrorHandover = handoverData._error;

    if (isErrorHandover) {
      // Special handling for malformed JSON handovers
      bulletPoints.push(`⚠️ Error: ${handoverData._error}`);
      if (handoverData._rawData) {
        bulletPoints.push(`📝 Datos crudos: ${handoverData._rawData}`);
      }
      if (handoverData._timestamp) {
        bulletPoints.push(`🕐 Timestamp: ${handoverData._timestamp}`);
      }
    } else {
      // Normal handover - extract common fields first (for ClaudIA, MarIA, etc.)

      // ClaudIA fields (gym leads)
      if (handoverData.goal) bulletPoints.push(`• Objetivo: ${handoverData.goal}`);
      if (handoverData.experience) bulletPoints.push(`• Experiencia: ${handoverData.experience}`);
      if (handoverData.schedule || handoverData.timing) {
        bulletPoints.push(`• Horario: ${handoverData.schedule || handoverData.timing}`);
      }
      if (handoverData.location) bulletPoints.push(`• Ubicación: ${handoverData.location}`);
      if (handoverData.level || handoverData.fitScore) {
        bulletPoints.push(`• Nivel: ${handoverData.level || handoverData.fitScore}`);
      }
      if (handoverData.injuries) bulletPoints.push(`• Lesiones: ${handoverData.injuries}`);
      if (handoverData.motivation) bulletPoints.push(`• Motivación: ${handoverData.motivation}`);
      if (handoverData.notes) bulletPoints.push(`• Notas: ${handoverData.notes}`);

      // MarIA fields (franchise leads)
      if (handoverData.city) bulletPoints.push(`• Ciudad: ${handoverData.city}`);
      if (handoverData.country_or_region) bulletPoints.push(`• País/Región: ${handoverData.country_or_region}`);
      if (handoverData.capital_range) bulletPoints.push(`• Rango de Capital: ${handoverData.capital_range}`);
      if (handoverData.experience_level) bulletPoints.push(`• Nivel de Experiencia: ${handoverData.experience_level}`);
      if (handoverData.timeline) bulletPoints.push(`• Horizonte Temporal: ${handoverData.timeline}`);
      if (handoverData.heard_from) bulletPoints.push(`• Cómo nos conoció: ${handoverData.heard_from}`);
      if (handoverData.has_trained_at_dlf) bulletPoints.push(`• Ha entrenado en DLFitness: ${handoverData.has_trained_at_dlf}`);
      if (handoverData.key_questions) bulletPoints.push(`• Preguntas clave: ${handoverData.key_questions}`);
      if (handoverData.concerns) bulletPoints.push(`• Preocupaciones: ${handoverData.concerns}`);

      // Add any other fields that might exist (future-proof for new agents)
      const knownKeys = [
        'goal', 'experience', 'schedule', 'timing', 'location', 'level', 'fitScore',
        'injuries', 'motivation', 'notes', 'city', 'country_or_region', 'capital_range',
        'experience_level', 'timeline', 'heard_from', 'has_trained_at_dlf',
        'key_questions', 'concerns'
      ];

      Object.keys(handoverData).forEach((key) => {
        if (!knownKeys.includes(key) && handoverData[key]) {
          bulletPoints.push(`• ${key}: ${handoverData[key]}`);
        }
      });
    }

    // Build dashboard link
    const dashboardLink = baseUrl
      ? `🔗 Abrir el dashboard: ${baseUrl}/chat?phone=${encodeURIComponent(clientPhone)}`
      : "";

    // Build message with agent name
    const agentDisplayName = agentName || "AI Agent";
    const summaryLines = [
      `📩 Nuevo Handover de ${agentDisplayName}`,
      `📞 Cliente: +${clientPhone}`,
      "",
      ...bulletPoints,
    ];

    if (dashboardLink) {
      summaryLines.push("");
      summaryLines.push(dashboardLink);
    }

    const summaryText = summaryLines.join("\n");

    console.log("[Handover] Summary text:", summaryText);

    // Send to supervisor
    const sent = await sendWhatsAppMessage({
      to: supervisorNumber,
      message: summaryText,
      type: "text",
    });

    if (sent) {
      console.log("[Handover] ✅ Handover summary sent successfully to supervisor");
    } else {
      console.error("[Handover] ❌ Failed to send handover summary");
    }

    console.log("[Handover] ========================================");

    return sent;
  } catch (error) {
    console.error("[Handover] ❌ Exception while sending handover summary:", error);
    return false;
  }
}
