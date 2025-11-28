import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { sendHandoverNotification, sendNewLeadNotification } from "@/lib/whatsapp-sender";

// POST /api/ai-agent - Process message with AI agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, userMessage, sessionId } = body;

    console.log("[AI Agent] Request:", agentId, userMessage);

    // Validation
    if (!agentId || !userMessage) {
      return NextResponse.json(
        { error: "Missing required fields: agentId, userMessage" },
        { status: 400 }
      );
    }

    // Fetch AI agent
    const aiAgent = await prisma.aiAgent.findUnique({
      where: { id: agentId },
    });

    if (!aiAgent) {
      console.error(`[AI Agent] Agent not found: ${agentId}`);
      return NextResponse.json(
        { error: "AI agent not found" },
        { status: 404 }
      );
    }

    if (!aiAgent.isActive) {
      console.error(`[AI Agent] Agent is inactive: ${agentId}`);
      return NextResponse.json(
        { error: "AI agent is inactive" },
        { status: 400 }
      );
    }

    console.log(`[AI Agent] Using agent: ${aiAgent.name}`);
    console.log(`[AI Agent] Language: ${aiAgent.language}, Tone: ${aiAgent.tone}`);
    console.log(`[AI Agent] Goal: ${aiAgent.goal || "N/A"}`);
    console.log(`[AI Agent] Max turns: ${aiAgent.maxTurns}`);
    console.log(`[AI Agent] Incoming message: "${userMessage}"`);
    console.log(`[AI Agent] Session ID: ${sessionId || "none"}`);

    // ✅ CHECK CREDENTIALS BEFORE CREATING CLIENT
    if (!process.env.OPENAI_API_KEY) {
      console.error("[AI Agent] ❌ ERROR: OPENAI_API_KEY is not set in environment");
      console.error("[AI Agent] Please add OPENAI_API_KEY to .env.local or Vercel environment variables");
      return NextResponse.json(
        { error: "OpenAI API key not configured", reply: "Ahora mismo no puedo pensar 😅 Vuelve a intentarlo en unos minutos." },
        { status: 500 }
      );
    }

    // Initialize OpenAI (only after confirming API key exists)
    console.log("[AI Agent] ✓ OPENAI_API_KEY found, initializing OpenAI client...");
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // 🚨 NEW LEAD NOTIFICATION: Send notification on first AI message in chat
    if (sessionId) {
      try {
        // Count messages sent by agent in this chat
        const aiMessageCount = await prisma.message.count({
          where: {
            chatId: sessionId,
            sender: "agent",
          },
        });

        console.log(`[AI Agent] Agent message count in this chat: ${aiMessageCount}`);

        if (aiMessageCount === 0) {
          console.log("[AI Agent] 🚨 This is the FIRST AI agent message in this chat!");
          console.log("[AI Agent] 📤 Sending new lead notification...");

          // Get chat info for notification
          const chat = await prisma.chat.findUnique({
            where: { id: sessionId },
            select: { phoneNumber: true, contactName: true },
          });

          if (chat) {
            sendNewLeadNotification({
              flowName: aiAgent.name || "AI Agent",
              phoneNumber: chat.phoneNumber,
              name: chat.contactName || null,
              email: null,
              source: "whatsapp-ai",
            }).catch((err) => {
              console.error("[AI Agent] ⚠️ Failed to send new lead notification:", err);
              // Don't fail the request if notification fails
            });
          }
        } else {
          console.log("[AI Agent] Not sending notification (agent message count: " + aiMessageCount + ")");
        }
      } catch (notifError) {
        console.error("[AI Agent] ⚠️ Error checking/sending notification:", notifError);
        // Continue processing even if notification fails
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 🌐 GLOBAL BASE PROMPT FOR ALL AI AGENTS
    // ═══════════════════════════════════════════════════════════════════════════
    // This base prompt applies to ALL agents (ClaudIA, MarIA, and any future agents).
    // It ensures consistent behavior across all AI interactions.
    // ═══════════════════════════════════════════════════════════════════════════

    const languageMap: Record<string, string> = {
      es: "Spanish",
      en: "English",
      pt: "Portuguese",
      fr: "French",
    };

    const languageName = languageMap[aiAgent.language] || aiAgent.language;

    // Get contact name from chat if available
    let contactName: string | null = null;
    if (sessionId) {
      try {
        const chat = await prisma.chat.findUnique({
          where: { id: sessionId },
          select: { contactName: true },
        });
        contactName = chat?.contactName || null;
        console.log(`[AI Agent] Contact name from chat: ${contactName || "not available"}`);
      } catch (err) {
        console.error("[AI Agent] Error fetching contact name:", err);
      }
    }

    // GLOBAL BASE SYSTEM PROMPT - Applies to ALL agents
    const baseSystemPrompt = `Eres un asistente virtual profesional de DLFitness.

REGLAS GLOBALES (OBLIGATORIAS PARA TODOS LOS AGENTES):

1. RITMO DE CONVERSACIÓN:
   • Responde SIEMPRE con mensajes cortos (1-3 frases).
   • Haz como MÁXIMO UNA pregunta por mensaje.
   • NUNCA envíes saludo + explicación + cierre en un solo mensaje.
   • NUNCA simules toda la conversación de una vez.
   • Avanza UN SOLO PASO cada vez que el usuario responde.
   • Espera la respuesta del usuario antes de continuar.

2. MANEJO DE NOMBRES:
   • Si conoces el nombre del usuario (ej. "${contactName || "Carmen"}"), úsalo naturalmente.
   • Si NO conoces el nombre, NO lo inventes y NUNCA uses placeholders como {primer_nombre}, {nombre}, etc.
   • Ejemplo CORRECTO con nombre: "Perfecto, Carmen 😊"
   • Ejemplo CORRECTO sin nombre: "Perfecto 😊"
   • Ejemplo INCORRECTO: "Perfecto, {primer_nombre} 😊"

3. CONTEXTO Y OFERTAS:
   • NO asumas que el usuario ha visto una oferta específica a menos que el contexto lo indique claramente.
   • Si no estás seguro del contexto, usa un saludo neutral y pregunta en qué puedes ayudar.
   • Ejemplo NEUTRAL: "Hola${contactName ? `, ${contactName}` : ""}! Soy ${aiAgent.name}, tu agente virtual de DLFitness. ¿En qué puedo ayudarte?"

4. SEGURIDAD TÉCNICA:
   • NUNCA muestres al usuario marcadores técnicos como [[HANDOVER]], JSON, llaves {}, corchetes [], ni código.
   • Estos elementos son SOLO para la máquina, el usuario NUNCA debe verlos.

5. CIERRE Y HANDOVER:
   • NO cierres la conversación hasta que tengas suficiente información útil para tu rol específico.
   • Solo cuando decidas que la conversación está lista para un humano:
     a) Envía un mensaje final de despedida al usuario (cálido, profesional, con aviso de que pueden contactar desde otro número).
     b) DESPUÉS del mensaje humano, añade [[HANDOVER]]{...json...} con los datos recopilados.

CONFIGURACIÓN:
• Idioma principal: ${languageName}
• Tono: ${aiAgent.tone}
${aiAgent.goal ? `• Objetivo: ${aiAgent.goal}` : ""}
• Máximo de intercambios: ${aiAgent.maxTurns}
${contactName ? `• Nombre del usuario: ${contactName}` : "• Nombre del usuario: No disponible (no uses placeholders)"}

Ahora sigue las instrucciones específicas de tu rol a continuación:

---
`;

    // Build agent-specific system prompt based on agent name
    let agentSpecificPrompt = "";

    // CLAUDIA - DLFitness gym assistant
    if (aiAgent.name.toLowerCase().includes("claudia")) {
      agentSpecificPrompt = `ROL: ClaudIA, asesora virtual de DLFitness especializada en gimnasio.

TU PERSONALIDAD:
• Cálida, cercana, energética y motivadora, como una coach de confianza.
• Máximo 2 emojis por mensaje.
• Humana, empática y profesional.
• Agradeces y validas cada respuesta.

TU OBJETIVO:
Recopilar información útil para que un asesor humano ayude al usuario:
• Objetivo fitness (perder grasa, tonificar, ganar músculo, etc.)
• Experiencia previa (primera vez, viene de otro gym, etc.)
• Horarios preferidos (mañanas, tardes, etc.)
• Ubicación / centro DLFitness más cercano
• Motivaciones y emociones (qué le impulsa, qué le frena)
• Lesiones o condiciones físicas (si existen)

SALUDO INICIAL:
• Si el contexto/flow indica que el usuario viene por una "oferta" específica (ej. semana gratis), puedes mencionarla.
• Si NO estás seguro del contexto, usa un saludo NEUTRAL como:
  "💬 Hola${contactName ? `, ${contactName}` : ""}! Soy ClaudIA, tu agente virtual de DLFitness. ¿En qué puedo ayudarte hoy?"
• Después del saludo, haz UNA pregunta (ej. experiencia, objetivo, etc.).

VARIANTES DE PREGUNTAS (usa estas para no sonar robótica):
• Experiencia: "¿Es tu primera vez entrenando o ya vienes con experiencia?" / "¿Te estás iniciando o vienes de otro gym?"
• Lesiones: "¿Hay alguna lesión que deba tener en cuenta?" / "¿Tienes alguna molestia en rodilla, espalda, hombro…?"
• Objetivos: "¿Cuál es tu objetivo principal?" / "¿Qué te gustaría conseguir en los próximos meses?"
• Horarios: "¿Qué horarios te vienen mejor?" / "¿Eres más de mañanas o de tardes?"
• Motivación: "¿Qué te ha impulsado a dar este paso?" / "¿Hay algo que te bloquee o te dé respeto?"
• Ubicación: "¿Sabes qué centro DLFitness te pilla más cerca?" / "¿En qué zona vives o trabajas?"

Ejemplo si el usuario menciona Benalúa:
"¡Benalúa está más cerca de lo que crees! 🏃‍♀️
📌 Calle Isabel La Católica, 18
🗺️ https://maps.app.goo.gl/EnWEFcxKMVAeqDcP9"

CUANDO CERRAR LA CONVERSACIÓN:
Solo cuando tengas suficiente información útil (objetivo, experiencia, horarios, ubicación, motivación, lesiones si hay).

MENSAJE FINAL (CUANDO CIERRES):
Escribe un mensaje similar a este (adapta el nombre si lo conoces):
"Perfecto${contactName ? `, ${contactName}` : ""} 😊

Un agente de DLFitness se pondrá en contacto contigo lo antes posible para ayudarte a reservar tu primera sesión y resolver cualquier duda que tengas 💬💪

Puede que te escribamos desde otro número oficial de DLFitness, así que no te preocupes si lo ves distinto.

Mientras tanto… ¡ve preparando la ropa deportiva, que esto empieza pronto! 😎👟"

DESPUÉS de este mensaje de despedida, AÑADE (en la misma respuesta):
[[HANDOVER]]{"goal":"...","location":"...","timing":"...","schedule":"...","level":"...","fitScore":"alto|medio|bajo","notes":"contexto útil"}

IMPORTANTE:
• El mensaje de despedida es para el USUARIO (lo verá).
• El [[HANDOVER]]{...} es para la MÁQUINA (el usuario NO lo verá).
• NUNCA escribas este mensaje final si aún no tienes información suficiente.
• NUNCA envíes saludo + cierre en el mismo mensaje inicial.

${aiAgent.systemPrompt || ""}`;

    }
    // MARIA - DLFitness franchise advisor
    else if (aiAgent.name.toLowerCase().includes("maria")) {
      agentSpecificPrompt = `ROL: MarIA, asesora virtual de DLFitness especializada en franquicias.

TU PERSONALIDAD:
• Profesional pero cercana, como un asesor de franquicias que sabe escuchar.
• Frases cortas, claras, sin tecnicismos innecesarios.
• Validas y agradeces cada respuesta.
• Máximo 2 emojis por mensaje (ej. 🙂💼💪).

TU OBJETIVO:
Recopilar información útil para que un asesor especializado ayude al lead:
• Ciudad o zona donde quiere abrir el DLFitness
• Motivación real para emprender
• Capital disponible (de forma suave, respetuosa)
• Experiencia previa en negocios / gestión / fitness
• Horizonte temporal (cuándo le gustaría abrir)
• Cómo nos conoció (redes, gimnasio cercano, recomendación, etc.)
• Qué le interesa saber de DLFitness

SALUDO INICIAL:
• Si el contexto/flow indica que el usuario viene por información de "franquicia", puedes mencionarlo.
• Si NO estás seguro del contexto, usa un saludo NEUTRAL como:
  "Hola${contactName ? `, ${contactName}` : ""}! Soy MarIA, asesora virtual de franquicias DLFitness. ¿En qué puedo ayudarte?"
• Después del saludo, haz UNA pregunta (ej. zona, motivación, etc.).

VARIANTES DE PREGUNTAS (una a la vez, no repitas la misma formulación):
• Zona: "¿En qué ciudad o zona estás pensando abrir?" / "¿Tienes ya una ubicación en mente?"
• Cómo nos conoció: "¿Cómo nos descubriste?" / "¿Has visto algún centro DLFitness en tu zona?"
• Motivación: "¿Qué te motiva a emprender con una franquicia de fitness?" / "¿Qué te atrae del modelo DLFitness?"
• Experiencia: "¿Tienes experiencia gestionando negocios o equipos?" / "¿Vienes del mundo empresa, del deporte, o empiezas desde cero?"
• Capital (suave): "¿En qué rango de inversión te sientes cómodo/a?" / "¿Prefieres una inversión contenida o un proyecto más grande?"
• Horizonte temporal: "¿Cuándo te gustaría tener tu centro en marcha?" / "¿Estás viendo la opción a corto plazo o aún comparando modelos?"
• Necesidades: "¿Qué te gustaría saber sobre nuestro modelo de franquicia?" / "¿Hay alguna duda concreta sobre inversión, retorno, soporte…?"

CUANDO CERRAR LA CONVERSACIÓN:
Solo cuando tengas suficiente información útil (zona, motivación, capital aprox., experiencia, timing, cómo nos conoció, qué busca saber).

MENSAJE FINAL (CUANDO CIERRES):
Escribe un mensaje similar a este (adapta el nombre si lo conoces):
"Perfecto${contactName ? `, ${contactName}` : ""}. Muchísimas gracias por toda la información 🙌

Un asesor especializado de DLFitness se pondrá en contacto contigo muy pronto para explicarte números, pasos y resolver tus dudas con detalle 💬💼

Es posible que te contactemos desde otro número oficial de DLFitness, así que no te preocupes si te llega un mensaje desde un teléfono diferente.

Gracias de nuevo por tu interés. Estamos aquí para ayudarte a tomar la mejor decisión."

DESPUÉS de este mensaje de despedida, AÑADE (en la misma respuesta):
[[HANDOVER]]{"city":"...","country_or_region":"...","motivation":"...","capital_range":"...","experience_level":"baja|media|alta","timeline":"...","heard_from":"...","has_trained_at_dlf":"sí|no|no_sabe","fitScore":"alto|medio|bajo","key_questions":"...","concerns":"..."}

IMPORTANTE:
• El mensaje de despedida es para el LEAD (lo verá).
• El [[HANDOVER]]{...} es para la MÁQUINA (el lead NO lo verá).
• NUNCA escribas este mensaje final si aún no tienes información suficiente.
• NUNCA envíes saludo + cierre en el mismo mensaje inicial.

${aiAgent.systemPrompt || ""}`;
    }

    // Combine base prompt with agent-specific prompt
    const enhancedSystemPrompt = baseSystemPrompt + agentSpecificPrompt;

    console.log(`[AI Agent] Enhanced system prompt built`);

    // Get conversation history if sessionId provided
    let messages: any[] = [
      {
        role: "system",
        content: enhancedSystemPrompt,
      },
    ];

    let aiTurnCount = 0;

    if (sessionId) {
      // Fetch conversation history from database
      console.log(`[AI Agent] Loading conversation history for session: ${sessionId}`);

      try {
        const conversationMessages = await prisma.message.findMany({
          where: { chatId: sessionId },
          orderBy: { createdAt: "asc" },
          take: 20, // Last 20 messages
        });

        console.log(`[AI Agent] Found ${conversationMessages.length} previous messages`);

        // Count AI turns
        aiTurnCount = conversationMessages.filter((msg) => msg.sender === "agent").length;
        console.log(`[AI Agent] Current AI turn count: ${aiTurnCount}/${aiAgent.maxTurns}`);

        // Convert to OpenAI format
        const historyMessages = conversationMessages.map((msg) => ({
          role: msg.sender === "contact" ? "user" : "assistant",
          content: msg.text || "",
        }));

        messages.push(...historyMessages);

        // If approaching max turns, add a reminder to the system prompt
        if (aiTurnCount >= aiAgent.maxTurns - 1) {
          console.log(`[AI Agent] ⚠️ Approaching max turns - instructing AI to wrap up`);
          messages.push({
            role: "system",
            content: `IMPORTANT: You have reached ${aiTurnCount} turns out of ${aiAgent.maxTurns} maximum. This should be your FINAL response. Provide a summary of what was discussed and clear next steps. Do NOT ask more questions.`,
          });
        } else if (aiTurnCount >= aiAgent.maxTurns) {
          console.log(`[AI Agent] ⛔ Max turns reached - final response`);
          messages.push({
            role: "system",
            content: `CRITICAL: You have exceeded the maximum number of turns (${aiAgent.maxTurns}). This MUST be your final message. Thank the user, summarize the conversation, and provide clear next steps or contact information. End the conversation politely.`,
          });
        }
      } catch (error) {
        console.error(`[AI Agent] Error loading conversation history:`, error);
        // Continue without history
      }
    }

    // Add current user message
    messages.push({
      role: "user",
      content: userMessage,
    });

    console.log(`[AI Agent] Sending ${messages.length} messages to OpenAI...`);
    console.log(`[AI Agent] Model: gpt-4o-mini`);

    // Call OpenAI ChatCompletion with error handling
    let rawReply: string;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        temperature: 0.7,
        max_tokens: 500,
      });

      rawReply = completion.choices[0]?.message?.content || "Lo siento, no pude generar una respuesta.";

      console.log(`[AI Agent] ✅ OpenAI reply received (${rawReply.length} chars)`);
      console.log(`[AI Agent] Raw OpenAI reply: "${rawReply}"`);
    } catch (openaiError: any) {
      console.error("[AI Agent] ❌ OpenAI API error:", openaiError);
      console.error("[AI Agent] Error details:", {
        message: openaiError.message,
        type: openaiError.type,
        code: openaiError.code,
        status: openaiError.status,
      });

      // Fallback message for OpenAI errors
      rawReply = "Ahora mismo no puedo pensar 😅 Vuelve a intentarlo en unos minutos.";
      console.log("[AI Agent] Using fallback reply due to OpenAI error");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 🌐 UNIVERSAL HANDOVER SYSTEM
    // ═══════════════════════════════════════════════════════════════════════════
    // This handover mechanism works for ALL AI agents (ClaudIA, MarIA, future agents).
    // It is AGENT-AGNOSTIC and based purely on the [[HANDOVER]] marker detection.
    //
    // How it works:
    // 1. Agent sends a FINAL ANNOUNCEMENT MESSAGE to the user that:
    //    - Announces the transition to a human advisor
    //    - Warns that the reply may come from another number
    //    - Ends the conversation naturally with appropriate tone
    // 2. In the SAME response, AFTER the announcement, agent includes [[HANDOVER]]{...json...}
    // 3. The system automatically splits the response into:
    //    - visiblePart: Human-friendly message (sent to WhatsApp user)
    //    - handoverPart: Machine-only JSON data (parsed internally)
    // 4. Only the visiblePart is sent to the user (NO JSON, NO markers visible)
    // 5. The JSON is parsed and sent to supervisor (David: 34644412937)
    // 6. If JSON parsing fails, a simplified notification is still sent
    //
    // This guarantees:
    // ✅ All agents automatically inherit handover capability
    // ✅ Users receive a professional final message before handover
    // ✅ Users are warned about potential number changes
    // ✅ No custom code needed per agent
    // ✅ Users never see technical data
    // ✅ Supervisors always get notified (even if JSON is malformed)
    // ═══════════════════════════════════════════════════════════════════════════

    const [visiblePart, handoverPart] = rawReply.split("[[HANDOVER]]");

    const messageForUser = visiblePart.trim();
    const handoverRaw = (handoverPart || "").trim();

    // Handle handover JSON safely with fallback notification
    let handoverData: any = null;
    if (handoverRaw) {
      console.log(`[AI Agent] 🔄 HANDOVER marker detected (agent: ${aiAgent.name})`);
      console.log(`[AI Agent] Raw handover data: ${handoverRaw.substring(0, 200)}...`);

      try {
        handoverData = JSON.parse(handoverRaw);
        console.log("[AI Agent] ========================================");
        console.log("[AI Agent] ✅ Successfully parsed HANDOVER payload");
        console.log("[AI Agent] HANDOVER raw text:", handoverRaw);
        console.log("[AI Agent] HANDOVER parsed data:", JSON.stringify(handoverData, null, 2));

        // Send handover summary to supervisor (David)
        if (sessionId) {
          console.log("[AI Agent] SessionId provided:", sessionId);

          // Get client phone number from chat
          const chat = await prisma.chat.findUnique({
            where: { id: sessionId },
            select: { phoneNumber: true },
          });

          console.log("[AI Agent] Chat lookup result:", chat ? `Found (phone: ${chat.phoneNumber})` : "NOT FOUND");
          console.log("[AI Agent] Chat phone number:", chat?.phoneNumber || "undefined");
          console.log("[AI Agent] Agent name:", aiAgent.name);

          if (chat && chat.phoneNumber) {
            console.log("[AI Agent] ✅ All data available for handover notification");
            console.log("[AI Agent] 📤 Calling sendHandoverNotification...");
            console.log("[AI Agent]    → handoverData:", JSON.stringify(handoverData));
            console.log("[AI Agent]    → clientPhone:", chat.phoneNumber);
            console.log("[AI Agent]    → agentName:", aiAgent.name);

            // Send notification (non-blocking, with error handling)
            sendHandoverNotification(handoverData, chat.phoneNumber, aiAgent.name)
              .then(() => {
                console.log("[AI Agent] ✅ sendHandoverNotification completed successfully");
              })
              .catch((err) => {
                console.error("[AI Agent] ❌ sendHandoverNotification FAILED:", err);
                console.error("[AI Agent] Error details:", {
                  message: err.message,
                  stack: err.stack,
                  name: err.name
                });
                // Don't fail the request if notification fails
              });
          } else {
            console.error("[AI Agent] ❌ CANNOT send handover notification");
            console.error("[AI Agent] Reason: chat or phone number not found");
            console.error("[AI Agent] Chat exists:", !!chat);
            console.error("[AI Agent] Phone number exists:", !!(chat?.phoneNumber));
          }
        } else {
          console.error("[AI Agent] ❌ CANNOT send handover notification");
          console.error("[AI Agent] Reason: no sessionId provided");
        }
        console.log("[AI Agent] ========================================");
      } catch (jsonError) {
        console.error("[AI Agent] ❌ Failed to parse HANDOVER JSON");
        console.error("[AI Agent] Raw data:", handoverRaw);
        console.error("[AI Agent] Parse error:", jsonError);

        // 🛡️ SAFEGUARD: Even if JSON parsing fails, notify supervisor with raw data
        if (sessionId) {
          const chat = await prisma.chat.findUnique({
            where: { id: sessionId },
            select: { phoneNumber: true },
          });

          if (chat && chat.phoneNumber) {
            console.log("[AI Agent] 🔄 Sending fallback notification with raw data...");

            // Create a simplified handover object with raw data
            const fallbackData = {
              _error: "JSON parsing failed",
              _rawData: handoverRaw.substring(0, 500), // Limit to 500 chars
              _agent: aiAgent.name,
              _timestamp: new Date().toISOString(),
            };

            sendHandoverNotification(fallbackData, chat.phoneNumber, aiAgent.name).catch((err) => {
              console.error("[AI Agent] ⚠️ Failed to send fallback notification:", err);
            });
          }
        }
      }
    }

    console.log(`[AI Agent] Message for user (clean): "${messageForUser}"`);

    return NextResponse.json({
      reply: messageForUser, // ✅ Send only the clean part (no JSON, no [[HANDOVER]])
      agentId,
      agentName: aiAgent.name,
      handoverData: handoverData || undefined, // Include handover data if present (for internal use)
    });
  } catch (error) {
    console.error("[AI Agent] ❌ Unexpected error processing message:", error);
    console.error("[AI Agent] Error stack:", error instanceof Error ? error.stack : "N/A");

    // Always return a fallback message so user gets something
    return NextResponse.json(
      {
        error: "Failed to process AI agent message",
        details: error instanceof Error ? error.message : "Unknown error",
        reply: "Ahora mismo no puedo pensar 😅 Vuelve a intentarlo en unos minutos."
      },
      { status: 500 }
    );
  }
}
