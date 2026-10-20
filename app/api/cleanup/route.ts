import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJson } from "@/lib/safe-response";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧹 AUTO-CLEANUP ENDPOINT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Automatically delete old conversation data to keep the database clean.
 *
 * USAGE:
 * 1. Call this endpoint manually: GET /api/cleanup
 * 2. Or set up a cron job (Vercel Cron, external scheduler, etc.):
 *    - Schedule: Every day at 2 AM
 *    - URL: https://your-domain.com/api/cleanup?token=YOUR_SECRET_TOKEN
 *
 * CONFIGURATION:
 * - Default: Delete conversations older than 5 days
 * - Can be customized with ?days=X query parameter
 *
 * SECURITY:
 * - Requires CLEANUP_TOKEN environment variable to prevent unauthorized access
 * - Set CLEANUP_TOKEN in your .env.local or Vercel environment variables
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

export async function GET(request: NextRequest) {
  try {
    console.log("[Cleanup] ========================================");
    console.log("[Cleanup] 🧹 Auto-cleanup endpoint called");

    // Security: Check token
    const searchParams = request.nextUrl.searchParams;
    const providedToken = searchParams.get("token");
    const expectedToken = process.env.CLEANUP_TOKEN;

    if (!expectedToken) {
      console.log("[Cleanup] ⚠️ CLEANUP_TOKEN not configured in environment");
      return safeJson(
        { error: "Cleanup token not configured" },
        { status: 500 }
      );
    }

    if (providedToken !== expectedToken) {
      console.log("[Cleanup] ❌ Invalid or missing token");
      return safeJson(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get days parameter (default: 5 days)
    const daysParam = searchParams.get("days");
    const days = daysParam ? parseInt(daysParam, 10) : 5;

    if (isNaN(days) || days < 1) {
      return safeJson(
        { error: "Invalid days parameter" },
        { status: 400 }
      );
    }

    console.log(`[Cleanup] Deleting conversations older than ${days} day(s)`);

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    console.log(`[Cleanup] Cutoff date: ${cutoffDate.toISOString()}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // CLEANUP OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════════

    // 1. Delete old messages
    const deletedMessages = await prisma.message.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`[Cleanup] ✅ Deleted ${deletedMessages.count} old message(s)`);

    // 2. Delete old session states
    const deletedSessions = await prisma.sessionState.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`[Cleanup] ✅ Deleted ${deletedSessions.count} old session(s)`);

    // 3. Delete old message logs
    const deletedMessageLogs = await prisma.messageLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`[Cleanup] ✅ Deleted ${deletedMessageLogs.count} old message log(s)`);

    // 4. Update chats with no messages to reset metadata
    const chatsWithNoMessages = await prisma.chat.findMany({
      where: {
        messages: {
          none: {},
        },
      },
      select: { id: true },
    });

    if (chatsWithNoMessages.length > 0) {
      await prisma.chat.updateMany({
        where: {
          id: {
            in: chatsWithNoMessages.map(c => c.id),
          },
        },
        data: {
          unreadCount: 0,
          lastMessagePreview: "",
        },
      });

      console.log(`[Cleanup] ✅ Reset ${chatsWithNoMessages.length} empty chat(s)`);
    }

    // ═══════════════════════════════════════════════════════════════════════════

    const summary = {
      success: true,
      cutoffDate: cutoffDate.toISOString(),
      daysOld: days,
      deleted: {
        messages: deletedMessages.count,
        sessions: deletedSessions.count,
        messageLogs: deletedMessageLogs.count,
        emptyChatsReset: chatsWithNoMessages.length,
      },
      timestamp: new Date().toISOString(),
    };

    console.log("[Cleanup] ========================================");
    console.log("[Cleanup] ✅ Cleanup completed successfully");
    console.log("[Cleanup] Summary:", JSON.stringify(summary, null, 2));
    console.log("[Cleanup] ========================================");

    return safeJson(summary);
  } catch (error) {
    console.error("[Cleanup] ❌ Error during cleanup:", error);
    return safeJson(
      {
        error: "Cleanup failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
