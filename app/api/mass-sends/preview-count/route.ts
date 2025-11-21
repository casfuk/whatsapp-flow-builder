import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/mass-sends/preview-count - Get count of contacts matching filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeTagsParam = searchParams.get("includeTags") || "[]";
    const excludeTagsParam = searchParams.get("excludeTags") || "[]";
    const contactsFromParam = searchParams.get("contactsFrom");
    const contactsToParam = searchParams.get("contactsTo");

    const includeTags: string[] = JSON.parse(includeTagsParam);
    const excludeTags: string[] = JSON.parse(excludeTagsParam);

    // Build where clause
    const whereConditions: any[] = [];

    // Date range filter
    if (contactsFromParam || contactsToParam) {
      const dateFilter: any = {};
      if (contactsFromParam) {
        dateFilter.gte = new Date(contactsFromParam);
      }
      if (contactsToParam) {
        dateFilter.lte = new Date(contactsToParam);
      }
      whereConditions.push({ createdAt: dateFilter });
    }

    // Get all contacts that match date filters
    let contacts = await prisma.contact.findMany({
      where: whereConditions.length > 0 ? { AND: whereConditions } : {},
      select: {
        id: true,
        tags: true,
      },
    });

    // Filter by include tags (contact must have at least ONE of the include tags)
    if (includeTags.length > 0) {
      contacts = contacts.filter((contact) => {
        const contactTags: string[] = JSON.parse(contact.tags);
        return includeTags.some((tagId) => contactTags.includes(tagId));
      });
    }

    // Filter by exclude tags (contact must NOT have ANY of the exclude tags)
    if (excludeTags.length > 0) {
      contacts = contacts.filter((contact) => {
        const contactTags: string[] = JSON.parse(contact.tags);
        return !excludeTags.some((tagId) => contactTags.includes(tagId));
      });
    }

    return NextResponse.json({ count: contacts.length });
  } catch (error) {
    console.error("Failed to get preview count:", error);
    return NextResponse.json(
      { error: "Failed to get preview count" },
      { status: 500 }
    );
  }
}
