import { prisma } from "@/lib/prisma";
import { sendAndPersistMessage } from "@/lib/whatsapp-message-service";

const QUESTION_EXPIRATION_MS = 60 * 60 * 1000; // 1 hour
const MAX_ATTEMPTS = 2; // Original + 1 follow-up
const MAX_BOT_MESSAGES_WITHOUT_REPLY = 2; // Safety guard: max bot messages in a row

/**
 * Checks if a chat needs a follow-up message and sends it if appropriate
 * @param chatId - The chat ID to check
 * @returns true if follow-up was sent, false otherwise
 */
export async function checkAndSendFollowup(chatId: string): Promise<boolean> {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 20, // Get more messages to check bot message count
      },
    },
  });

  if (!chat) {
    console.log(`[Follow-up] Skipping - chat ${chatId} not found`);
    return false;
  }

  console.log(`[Follow-up] Checking chat ${chatId} (phone: ${chat.phoneNumber})`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. CHECK IF AI IS DISABLED
  // ═══════════════════════════════════════════════════════════════════════════
  if (chat.aiDisabled) {
    console.log(`[Follow-up] Skipping chat ${chatId} - aiDisabled is true`);
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. CHECK IF CHAT IS ASSIGNED TO AI
  // ═══════════════════════════════════════════════════════════════════════════
  if (chat.assignedAgentType !== "AI" || !chat.assignedAgentId) {
    console.log(`[Follow-up] Skipping chat ${chatId} - not assigned to AI agent`);
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CHECK IF QUESTION WAS SENT
  // ═══════════════════════════════════════════════════════════════════════════
  if (!chat.lastQuestionSentAt) {
    console.log(`[Follow-up] Skipping chat ${chatId} - no question sent (lastQuestionSentAt is null)`);
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. CHECK IF USER ALREADY REPLIED
  // ═══════════════════════════════════════════════════════════════════════════
  if (
    chat.lastUserReplyAt &&
    chat.lastUserReplyAt > chat.lastQuestionSentAt
  ) {
    console.log(
      `[Follow-up] Skipping chat ${chatId} - user already replied (lastUserReplyAt: ${chat.lastUserReplyAt.toISOString()} > lastQuestionSentAt: ${chat.lastQuestionSentAt.toISOString()})`
    );
    // Reset attempts since user replied
    await prisma.chat.update({
      where: { id: chatId },
      data: { lastQuestionAttempts: 0 },
    });
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. CHECK IF MAX ATTEMPTS REACHED
  // ═══════════════════════════════════════════════════════════════════════════
  if (chat.lastQuestionAttempts >= MAX_ATTEMPTS) {
    console.log(
      `[Follow-up] Skipping chat ${chatId} - max attempts reached (${chat.lastQuestionAttempts}/${MAX_ATTEMPTS})`
    );
    return false;
  }

  const now = new Date();
  const timeSinceQuestion =
    now.getTime() - chat.lastQuestionSentAt.getTime();
  const minutesSinceQuestion = Math.floor(timeSinceQuestion / 1000 / 60);

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. CHECK IF QUESTION EXPIRED (>1 HOUR)
  // ═══════════════════════════════════════════════════════════════════════════
  if (timeSinceQuestion > QUESTION_EXPIRATION_MS) {
    console.log(`[Follow-up] Skipping chat ${chatId} - question expired (${minutesSinceQuestion}min > 60min)`);
    // Reset tracking fields
    await prisma.chat.update({
      where: { id: chatId },
      data: {
        lastQuestionSentAt: null,
        lastQuestionAttempts: 0,
        lastQuestionMessageId: null,
      },
    });
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. AGENT FOLLOW-UP SETTINGS (configured per agent in the UI)
  // ═══════════════════════════════════════════════════════════════════════════
  const aiAgent = await prisma.aiAgent.findUnique({
    where: { id: chat.assignedAgentId },
  });

  if (!aiAgent) {
    console.error(`[Follow-up] AI agent ${chat.assignedAgentId} not found for chat ${chatId}`);
    return false;
  }

  if (!aiAgent.followupEnabled) {
    return false;
  }

  const followupDelayMs = Math.max(1, aiAgent.followupDelayMinutes) * 60 * 1000;
  if (timeSinceQuestion < followupDelayMs) {
    console.log(
      `[Follow-up] Skipping chat ${chatId} - not enough time elapsed (${minutesSinceQuestion}min < ${aiAgent.followupDelayMinutes}min)`
    );
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. SAFETY GUARD: CHECK BOT MESSAGE COUNT
  // ═══════════════════════════════════════════════════════════════════════════
  // Count how many bot messages have been sent since the last user message
  const lastUserMessage = chat.messages.find((msg) => msg.sender === "contact");
  const botMessagesSinceLastUser = lastUserMessage
    ? chat.messages.filter(
        (msg) =>
          (msg.sender === "agent" || msg.sender === "flow") &&
          msg.createdAt > lastUserMessage.createdAt
      ).length
    : chat.messages.filter((msg) => msg.sender === "agent" || msg.sender === "flow").length;

  if (botMessagesSinceLastUser >= MAX_BOT_MESSAGES_WITHOUT_REPLY) {
    console.log(
      `[Follow-up] ⚠️ SAFETY GUARD: Skipping chat ${chatId} - already sent ${botMessagesSinceLastUser} bot messages without user reply (max: ${MAX_BOT_MESSAGES_WITHOUT_REPLY})`
    );
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. GENERATE FOLLOW-UP MESSAGE (SHORT VARIATION, NOT GREETING)
  // ═══════════════════════════════════════════════════════════════════════════
  const followupMessage = generateFollowupMessage(aiAgent);

  try {
    console.log(`[Follow-up] ✅ Sending follow-up (attempt ${chat.lastQuestionAttempts + 1}/${MAX_ATTEMPTS}) to chat ${chatId}`);

    // Send the follow-up message
    await sendAndPersistMessage({
      deviceId: chat.deviceId,
      toPhoneNumber: chat.phoneNumber,
      type: "text",
      payload: {
        text: { body: followupMessage },
      },
      sender: "agent",
      textPreview: followupMessage,
      chatId: chat.id,
      agentId: aiAgent.id,
    });

    // Update chat tracking (DO NOT update lastQuestionSentAt - keep it pointing to the original question)
    await prisma.chat.update({
      where: { id: chatId },
      data: {
        lastQuestionAttempts: chat.lastQuestionAttempts + 1,
      },
    });

    console.log(
      `[Follow-up] ✅ Successfully sent follow-up to chat ${chatId} (total attempts: ${chat.lastQuestionAttempts + 1}/${MAX_ATTEMPTS})`
    );
    return true;
  } catch (error) {
    console.error(`[Follow-up] ❌ Failed to send follow-up to chat ${chatId}:`, error);
    return false;
  }
}

const DEFAULT_FOLLOWUPS: Record<string, string[]> = {
  es: ["¿Sigues ahí? 😊", "¿Tienes alguna duda?", "¿Necesitas más información?"],
  en: ["Are you still there? 😊", "Do you have any questions?", "Would you like more information?"],
};

/**
 * Picks a short follow-up reminder (NOT a greeting) from the agent's own
 * follow-up messages (one per line), or a neutral default in its language.
 */
export function generateFollowupMessage(agent: { followupMessages: string | null; language: string }): string {
  const configured = (agent.followupMessages || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const variations = configured.length > 0 ? configured : DEFAULT_FOLLOWUPS[agent.language] || DEFAULT_FOLLOWUPS.en;
  return variations[Math.floor(Math.random() * variations.length)];
}

/**
 * Scans all active AI chats and sends follow-ups where needed
 * This should be called periodically (e.g., every minute via cron job)
 */
export async function processAllFollowups(): Promise<void> {
  console.log("[Follow-up] ═══════════════════════════════════════════════════════");
  console.log("[Follow-up] Starting follow-up processing scan...");
  console.log("[Follow-up] ═══════════════════════════════════════════════════════");

  try {
    // Find all chats that potentially need follow-ups
    // More liberal query - we'll do detailed checks in checkAndSendFollowup()
    const chatsNeedingFollowup = await prisma.chat.findMany({
      where: {
        assignedAgentType: "AI",
        assignedAgentId: { not: null },
        lastQuestionSentAt: { not: null },
        lastQuestionAttempts: { lt: MAX_ATTEMPTS },
        status: "open",
        aiDisabled: false, // Don't even query disabled chats
      },
    });

    console.log(
      `[Follow-up] Found ${chatsNeedingFollowup.length} potential chats to check`
    );

    if (chatsNeedingFollowup.length === 0) {
      console.log("[Follow-up] No chats need follow-ups at this time");
      return;
    }

    let sentCount = 0;
    let skippedCount = 0;

    for (const chat of chatsNeedingFollowup) {
      const sent = await checkAndSendFollowup(chat.id);
      if (sent) {
        sentCount++;
      } else {
        skippedCount++;
      }
    }

    console.log("[Follow-up] ═══════════════════════════════════════════════════════");
    console.log(`[Follow-up] ✅ Processed ${chatsNeedingFollowup.length} chats`);
    console.log(`[Follow-up] ✅ Sent: ${sentCount} follow-ups`);
    console.log(`[Follow-up] ⏭️ Skipped: ${skippedCount} chats`);
    console.log("[Follow-up] ═══════════════════════════════════════════════════════");
  } catch (error) {
    console.error("[Follow-up] ❌ Error processing follow-ups:", error);
  }
}
