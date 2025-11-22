import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Chat } from "@/app/types/chat";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tab = searchParams.get("tab") || "all";
    const status = searchParams.get("status") || "all";
    const deviceId = searchParams.get("deviceId");
    const tagsParam = searchParams.get("tags");
    const search = searchParams.get("search");
    const sort = searchParams.get("sort") || "name_asc";

    // Build where clause
    const where: any = {};

    // Tab filters
    if (tab === "mine") {
      // TODO: Get current user ID from session/auth
      // For now, filter by non-null assignedToUserId
      where.assignedToUserId = { not: null };
    } else if (tab === "favorites") {
      where.isFavorite = true;
    }

    // Status filters
    if (status === "unread") {
      where.unreadCount = { gt: 0 };
    } else if (status === "open") {
      where.status = "open";
    } else if (status === "closed") {
      where.status = "closed";
    }

    // Device filter
    if (deviceId) {
      where.deviceId = deviceId;
    }

    // Tags filter
    if (tagsParam) {
      const tagIds = tagsParam.split(",").filter(Boolean);
      if (tagIds.length > 0) {
        // Filter chats that have at least one of the specified tags
        // Since tags is stored as JSON array string
        where.tags = {
          contains: tagIds[0], // Simple approach - contains at least first tag
        };
      }
    }

    // Search filter
    if (search && search.trim()) {
      where.OR = [
        { contactName: { contains: search, mode: "insensitive" } },
        { phoneNumber: { contains: search } },
        { lastMessagePreview: { contains: search, mode: "insensitive" } },
      ];
    }

    // Fetch chats
    const chats = await prisma.chat.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
    });

    // Parse tags from JSON and format response
    const formattedChats: Chat[] = chats.map((chat) => ({
      id: chat.id,
      contactName: chat.contactName,
      phoneNumber: chat.phoneNumber,
      lastMessagePreview: chat.lastMessagePreview,
      lastMessageAt: chat.lastMessageAt.toISOString(),
      unreadCount: chat.unreadCount,
      status: chat.status as "open" | "closed",
      tags: chat.tags ? JSON.parse(chat.tags) : [],
      deviceId: chat.deviceId,
      isFavorite: chat.isFavorite,
      assignedToUserId: chat.assignedToUserId,
    }));

    // Sort by contact name if requested
    if (sort === "name_asc") {
      formattedChats.sort((a, b) => {
        const nameA = a.contactName || a.phoneNumber;
        const nameB = b.contactName || b.phoneNumber;
        return nameA.localeCompare(nameB);
      });
    } else if (sort === "name_desc") {
      formattedChats.sort((a, b) => {
        const nameA = a.contactName || a.phoneNumber;
        const nameB = b.contactName || b.phoneNumber;
        return nameB.localeCompare(nameA);
      });
    }

    return NextResponse.json({ chats: formattedChats });
  } catch (error) {
    console.error("Failed to fetch chats:", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, phoneNumber } = body;

    if (!deviceId || !phoneNumber) {
      return NextResponse.json(
        { error: "deviceId and phoneNumber are required" },
        { status: 400 }
      );
    }

    // Validate device exists
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    // Check if chat already exists
    let chat = await prisma.chat.findUnique({
      where: {
        phoneNumber_deviceId: {
          phoneNumber,
          deviceId,
        },
      },
    });

    // If chat doesn't exist, create it
    if (!chat) {
      // Try to get contact name from Contact model
      const contact = await prisma.contact.findUnique({
        where: { phone: phoneNumber },
      });

      chat = await prisma.chat.create({
        data: {
          phoneNumber,
          deviceId,
          contactName: contact?.name || null,
          lastMessagePreview: "Nuevo chat",
          lastMessageAt: new Date(),
          status: "open",
          unreadCount: 0,
        },
      });
    }

    // Format response
    const formattedChat: Chat = {
      id: chat.id,
      contactName: chat.contactName,
      phoneNumber: chat.phoneNumber,
      lastMessagePreview: chat.lastMessagePreview,
      lastMessageAt: chat.lastMessageAt.toISOString(),
      unreadCount: chat.unreadCount,
      status: chat.status as "open" | "closed",
      tags: chat.tags ? JSON.parse(chat.tags) : [],
      deviceId: chat.deviceId,
      isFavorite: chat.isFavorite,
      assignedToUserId: chat.assignedToUserId,
    };

    return NextResponse.json(formattedChat, { status: 201 });
  } catch (error) {
    console.error("Failed to create chat:", error);
    return NextResponse.json(
      { error: "Failed to create chat" },
      { status: 500 }
    );
  }
}
