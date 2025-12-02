import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/metrics
 * Returns dashboard metrics for contacts, messages, and automations
 * Supports query param: period=day|week|month (default: month)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "month";

    // Calculate date range based on period
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case "day":
        startDate.setDate(now.getDate() - 1);
        break;
      case "week":
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(now.getMonth() - 1);
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }

    // Fetch metrics in parallel
    const [
      totalContacts,
      newContacts,
      totalMessages,
      newMessages,
      totalAutomations,
      automationExecutions,
      contactsByDay,
      messagesByDay,
    ] = await Promise.all([
      // Total contacts
      prisma.contact.count(),

      // New contacts in period
      prisma.contact.count({
        where: {
          createdAt: {
            gte: startDate,
          },
        },
      }),

      // Total messages (from Chat.messages)
      prisma.message.count(),

      // New messages in period
      prisma.message.count({
        where: {
          createdAt: {
            gte: startDate,
          },
        },
      }),

      // Total automations (flows)
      prisma.flow.count(),

      // Total automation executions (sum of all flow executions)
      prisma.flow.aggregate({
        _sum: {
          executions: true,
        },
      }),

      // Contacts by day (for chart)
      prisma.$queryRaw`
        SELECT
          DATE("createdAt") as date,
          COUNT(*)::int as count
        FROM "Contact"
        WHERE "createdAt" >= ${startDate}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,

      // Messages by day (for chart)
      prisma.$queryRaw`
        SELECT
          DATE("createdAt") as date,
          COUNT(*)::int as count
        FROM "Message"
        WHERE "createdAt" >= ${startDate}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
    ]);

    return NextResponse.json({
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      metrics: {
        contacts: {
          total: totalContacts,
          new: newContacts,
          byDay: contactsByDay,
        },
        messages: {
          total: totalMessages,
          new: newMessages,
          byDay: messagesByDay,
        },
        automations: {
          total: totalAutomations,
          executions: automationExecutions._sum.executions || 0,
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch metrics:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch metrics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
