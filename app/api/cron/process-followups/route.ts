import { NextRequest } from "next/server";
import { processAllFollowups } from "@/lib/followup-service";
import { safeJson } from "@/lib/safe-response";

/**
 * GET /api/cron/process-followups
 *
 * Cron job endpoint that checks all active AI chats and sends follow-up messages
 * where appropriate (2 minutes after no reply, max 1 follow-up per question).
 *
 * Should be called periodically (e.g., every minute) via:
 * - Vercel Cron Jobs (vercel.json)
 * - External cron service (e.g., cron-job.org)
 * - GitHub Actions
 *
 * Authentication: Uses CRON_SECRET environment variable for security
 */
export async function GET(request: NextRequest) {
  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // 🔐 AUTHENTICATION: Verify cron secret
    // ═══════════════════════════════════════════════════════════════════════════
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Fail closed: without a configured CRON_SECRET nobody can trigger the job
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error("[Cron] Unauthorized follow-up processing attempt");
      return safeJson(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[Cron] ▶️ Starting follow-up processing job...");
    const startTime = Date.now();

    // Process all follow-ups
    await processAllFollowups();

    const duration = Date.now() - startTime;
    console.log(`[Cron] ✅ Follow-up processing completed in ${duration}ms`);

    return safeJson({
      success: true,
      message: "Follow-up processing completed",
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] ❌ Error processing follow-ups:", error);
    return safeJson(
      {
        error: "Failed to process follow-ups",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
