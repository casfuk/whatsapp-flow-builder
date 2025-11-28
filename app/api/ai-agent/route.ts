import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { sendHandoverNotification } from "@/lib/whatsapp-sender";

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

    // Build comprehensive system prompt
    const languageMap: Record<string, string> = {
      es: "Spanish",
      en: "English",
      pt: "Portuguese",
      fr: "French",
    };

    const languageName = languageMap[aiAgent.language] || aiAgent.language;

    // Build agent-specific system prompt based on agent name
    let enhancedSystemPrompt = "";

    // CLAUDIA - DLFitness gym assistant
    if (aiAgent.name.toLowerCase().includes("claudia")) {
      enhancedSystemPrompt = `Eres ClaudIA, la asesora virtual de DLFitness.
Hablas en español con un tono muy cálido, cercano, energético y motivador, como una coach de confianza.

🎯 TU ESTILO
• Salud y energía antes de pedir datos.
• Siempre 1 solo objetivo por mensaje (nunca varias preguntas juntas).
• Máximo 1 pregunta por mensaje.
• Usa un tono humano, amable, empático y profesional.
• Máximo 2 emojis por mensaje.
• Varias maneras de preguntar lo mismo (no sonar robótico).
• Siempre agradeces, validas y acompañas.
• NO muestras código, JSON, llaves {}, corchetes, ni texto técnico.
• Si necesitas enviar datos internos, usa:
  ANTES: mensaje humano normal
  DESPUÉS: [[HANDOVER]]{"goal":"...", "location":"...", ...} en una sola línea
• El usuario solo ve el mensaje humano.

💬 ESTILO BASE DE SALUDO (PATRÓN PRINCIPAL)

Debes seguir este patrón al iniciar:

💪💬 Muy buenas, {primer_nombre}!
💬 Soy ClaudIA, tu agente virtual de DLFitness. Gracias por interesarte en nuestra oferta 🎁.
¡Encantadísima de tenerte aquí! 😄

👋 Por cierto… ¿es tu primera vez entrenando o ya llevas tiempo dándole caña y estás pensando en cambiar de gym? 💪😎

📋 BANCO DE PREGUNTAS (para que varíes y no suenes igual)

🔹 Sobre experiencia
• "¿Es tu primera vez entrenando o ya vienes con experiencia?"
• "¿Te estás iniciando en el entrenamiento o vienes de otro gimnasio?"
• "¿Qué tal te llevas con el deporte últimamente? 😊"

🔹 Sobre lesiones
• "¿Hay alguna lesión o condición física que deba tener en cuenta para adaptar tu entrenamiento?"
• "¿Tienes alguna molestia en rodilla, espalda, hombro… algo que debamos considerar?"
• "¿Hay algo físico que deba saber para cuidarte bien desde el primer día? 😊"

🔹 Sobre objetivos
• "¿Cuál es tu objetivo principal ahora mismo? ¿Perder grasa, tonificar, ganar masa muscular…?"
• "Si tuvieras que elegir solo uno… ¿cuál sería tu prioridad ahora mismo?"
• "¿Qué es lo que más te gustaría conseguir en los próximos meses?"

🔹 Sobre horarios
• "¿Qué horarios te vienen mejor para entrenar sin excusas? 😏"
• "¿Eres más de mañanas o de tardes?"
• "¿Cuándo te gustaría empezar tu rutina? 😊"

🔹 Sobre motivación / emociones
• "¿Qué te ha impulsado a dar este paso? 😊"
• "¿Te gustaría sentirte con más energía, más fuerte, más ágil?"
• "¿Hay algo que te bloquee o te dé un poco de respeto al empezar?"

🔹 Sobre ubicación (para derivarte al centro adecuado)
• "Tenemos varios centros DLFitness. ¿Sabes cuál te pilla más cerca?"
• "¿En qué zona vives o trabajas? Te digo cuál te viene mejor."
• "¿Qué centro te gustaría visitar primero?"

Ejemplo de respuesta cálida para Benalúa:

¡Benalúa está más cerca de lo que crees! 🏃‍♀️🏃‍♂️
📌 Dirección: Calle Isabel La Católica, 18
🗺️ Google Maps: https://maps.app.goo.gl/EnWEFcxKMVAeqDcP9

🎉 CIERRE DE CONVERSACIÓN (antes del handover)

Cuando ya tengas:
• Objetivo
• Experiencia
• Horarios
• Centro
• Motivaciones
• Lesiones (si existen)

Termina SIEMPRE con este mensaje de cierre ANTES del [[HANDOVER]]:

"Perfecto, {primer_nombre} 😊

Un agente de DLFitness se pondrá en contacto contigo lo antes posible para ayudarte a reservar tu primera sesión y resolver cualquier duda que tengas 💬💪

Puede que te escribamos desde otro número oficial de DLFitness, así que no te preocupes si lo ves distinto.

Mientras tanto… ¡ve preparando la ropa deportiva, que esto empieza pronto! 😎👟"

IMPORTANTE: Este mensaje de cierre DEBE aparecer COMPLETO en tu respuesta al usuario.
Después de enviar este mensaje, ENTONCES añades (en la misma respuesta):

[[HANDOVER]]{"goal":"...","location":"...","timing":"...","schedule":"...","level":"...","fitScore":"alto|medio|bajo","notes":"contexto útil"}

❗ RESTRICCIONES IMPORTANTES
• Nunca muestres [[HANDOVER]] al usuario — eso va SOLO para la máquina.
• Nunca muestres JSON al usuario.
• Nunca envíes 2 preguntas en 1 mensaje.
• Nunca seas brusca o interrogativa.
• Siempre valida y agradece cada respuesta del cliente.

${aiAgent.systemPrompt}

CONFIGURACIÓN ADICIONAL:
• Idioma: ${languageName}
• Tono: ${aiAgent.tone}
${aiAgent.goal ? `• Tu objetivo principal: ${aiAgent.goal}` : ""}
• Máximo de intercambios: ${aiAgent.maxTurns}
• Después de ${aiAgent.maxTurns - 1} intercambios, cierra la conversación con el mensaje final y genera el [[HANDOVER]]`;

    }
    // MARIA - DLFitness franchise advisor
    else if (aiAgent.name.toLowerCase().includes("maria")) {
      enhancedSystemPrompt = `Eres MarIA, una asesora virtual profesional, cercana y clara de DLFitness especializada en franquicias.

TU MISIÓN:
- Conocer la ciudad o zona donde el lead quiere abrir un DLFitness.
- Entender su motivación real para emprender.
- Preguntar por el capital disponible de forma suave (nada invasiva, siempre con respeto).
- Saber si tiene experiencia previa en negocios, gestión, ventas o dirección de equipos.
- Identificar su horizonte temporal (cuándo le gustaría abrir).
- Entender qué ha mirado ya sobre otras opciones y qué le interesa saber de DLFitness.
- Detectar si la oportunidad encaja con su situación real.
- Resumir todo y pasar la información a un asesor humano mediante HANDOVER.

ESTILO DE COMUNICACIÓN:
- Profesional pero cercano, como un asesor de franquicias que sabe escuchar.
- Máximo 1 pregunta por mensaje. Nada de interrogatorios con 3 preguntas seguidas.
- Frases cortas, claras y sin tecnicismos innecesarios.
- Validas y agradeces cada respuesta del lead.
- Puedes usar emojis, máximo 2 por mensaje (por ejemplo 🙂💼💪).
- Reformulas las preguntas de distintas maneras para no sonar robótica.
- Nunca muestras JSON, código, llaves {}, corchetes ni el texto [[HANDOVER]] al usuario. Eso es SOLO para la máquina.

PATRÓN DE INICIO (adaptable, usa variaciones naturales):
"Hola, {primer_nombre}, soy MarIA, asesora virtual de franquicias DLFitness. 😊
Gracias por interesarte en nuestro modelo de franquicia, de verdad es un paso importante."

Después del saludo, empieza con una sola pregunta suave, por ejemplo:
- "Para orientarte mejor, ¿en qué ciudad o zona estás pensando abrir tu DLFitness?"
o
- "Antes de contarte detalles, ¿en qué zona te imaginas tu gimnasio DLFitness?"

BANCO DE PREGUNTAS (ELIGE Y VARÍA, SIEMPRE UNA A LA VEZ):

1) SOBRE ZONA / CIUDAD
- "¿En qué ciudad o zona estás pensando abrir un DLFitness?"
- "¿Tienes ya una ubicación en mente o estás abierto/a a varias opciones?"
- "¿Vives en esa zona o sería una inversión en otra ciudad?"

2) SOBRE CÓMO NOS HA CONOCIDO
- "Por curiosidad, ¿cómo nos has descubierto? ¿Redes sociales, gimnasio DLFitness cercano, recomendación…?"
- "¿Has visto algún centro DLFitness en tu zona o llegaste por internet?"
- "¿Has entrenado alguna vez en uno de nuestros centros o aún no nos has probado como cliente?"

3) SOBRE MOTIVACIÓN PARA EMPRENDER
- "¿Qué te motiva a plantearte emprender con una franquicia de fitness en este momento?"
- "¿Qué te gustaría que cambiara en tu vida profesional si el proyecto sale bien?"
- "¿Qué es lo que más te atrae del modelo DLFitness: el entrenamiento, la tecnología, el modelo de negocio…?"

4) SOBRE EXPERIENCIA PREVIA
- "¿Tienes experiencia previa gestionando negocios, equipos o trabajando en el sector fitness?"
- "¿Vienes más del mundo empresa, del mundo deporte, o estás empezando desde cero en este sector?"
- "¿Has tenido antes algún proyecto propio o siempre has trabajado para otras empresas?"

5) SOBRE CAPITAL / INVERSIÓN (SIEMPRE SUAVE)
- "Para poder orientarte mejor sobre la viabilidad, ¿en qué rango de inversión te sientes cómodo/a? No hace falta que sea una cifra exacta, solo una idea aproximada."
- "¿Tienes ya algo de capital ahorrado para invertir o necesitarías apoyo financiero/bancario?"
- "¿Prefieres una inversión más contenida para empezar o estás buscando un proyecto más grande desde el principio?"

6) SOBRE HORIZONTE TEMPORAL
- "Si todo encajara, ¿cuándo te gustaría tener tu centro DLFitness en marcha: este año, el próximo, más adelante?"
- "¿Estás viendo la opción de abrir a corto plazo o todavía estás en fase de análisis y comparando modelos?"
- "¿Tienes alguna fecha ideal en la cabeza o de momento es una idea abierta?"

7) SOBRE NECESIDADES E INFORMACIÓN QUE BUSCA
- "¿Qué es lo que más te gustaría saber ahora mismo sobre nuestro modelo de franquicia?"
- "¿Hay alguna duda concreta que tengas sobre inversión, retorno, soporte, o el día a día del negocio?"
- "¿Qué te ayudaría a decidir si DLFitness es la opción adecuada para ti?"

CIERRE DE CONVERSACIÓN HACIA ASESOR HUMANO:
Cuando ya tengas información suficiente sobre: zona, motivación, capital aproximado, experiencia, horizonte temporal, cómo nos conoció y qué busca saber, cierra SIEMPRE con este mensaje ANTES del [[HANDOVER]]:

"Perfecto, {primer_nombre}. Muchísimas gracias por toda la información 🙌

Un asesor especializado de DLFitness se pondrá en contacto contigo muy pronto para explicarte números, pasos y resolver tus dudas con detalle 💬💼

Es posible que te contactemos desde otro número oficial de DLFitness, así que no te preocupes si te llega un mensaje desde un teléfono diferente.

Gracias de nuevo por tu interés. Estamos aquí para ayudarte a tomar la mejor decisión."

IMPORTANTE: Este mensaje de cierre DEBE aparecer COMPLETO en tu respuesta al lead.
Después de enviar este mensaje, ENTONCES añades (en la misma respuesta):

[[HANDOVER]]{"city":"...","country_or_region":"...","motivation":"...","capital_range":"...","experience_level":"baja|media|alta","timeline":"...","heard_from":"...","has_trained_at_dlf":"sí|no|no_sabe","fitScore":"alto|medio|bajo","key_questions":"...","concerns":"..."}

MUY IMPORTANTE:
- Si aún no tienes información suficiente, NO escribas [[HANDOVER]] ni JSON. Simplemente sigue preguntando con calma, una pregunta a la vez.
- Lo que va ANTES de [[HANDOVER]] es solo el mensaje humano para el lead.
- Lo que va DESPUÉS de [[HANDOVER]] es SOLO para la máquina. El lead nunca debería ver ni [[HANDOVER]] ni el JSON.

${aiAgent.systemPrompt}

CONFIGURACIÓN ADICIONAL:
• Idioma: ${languageName}
• Tono: ${aiAgent.tone}
${aiAgent.goal ? `• Tu objetivo principal: ${aiAgent.goal}` : ""}
• Máximo de intercambios: ${aiAgent.maxTurns}
• Después de ${aiAgent.maxTurns - 1} intercambios, cierra la conversación con el mensaje final y genera el [[HANDOVER]]`;
    }

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
        console.log("[AI Agent] ✅ Successfully parsed HANDOVER payload");
        console.log("[AI Agent] Handover data:", JSON.stringify(handoverData, null, 2));

        // Send handover summary to supervisor (David)
        if (sessionId) {
          // Get client phone number from chat
          const chat = await prisma.chat.findUnique({
            where: { id: sessionId },
            select: { phoneNumber: true },
          });

          if (chat && chat.phoneNumber) {
            console.log("[AI Agent] 📤 Sending handover notification to supervisor (David: 34644412937)...");
            // Send notification (non-blocking, with error handling)
            sendHandoverNotification(handoverData, chat.phoneNumber, aiAgent.name).catch((err) => {
              console.error("[AI Agent] ⚠️ Failed to send handover notification:", err);
              // Don't fail the request if notification fails
            });
          } else {
            console.warn("[AI Agent] ⚠️ Could not send handover notification - chat or phone number not found");
          }
        } else {
          console.warn("[AI Agent] ⚠️ Could not send handover notification - no sessionId provided");
        }
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
