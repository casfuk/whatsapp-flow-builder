import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/mass-sends - List all mass sends
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";

    const massSends = await prisma.massSend.findMany({
      where: search
        ? {
            name: {
              contains: search,
              mode: "insensitive",
            },
          }
        : {},
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(massSends);
  } catch (error) {
    console.error("Failed to fetch mass sends:", error);
    return NextResponse.json(
      { error: "Failed to fetch mass sends" },
      { status: 500 }
    );
  }
}

// POST /api/mass-sends - Create a new mass send
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      name,
      deviceId,
      body: messageBody,
      mediaType = "NONE",
      mediaUrl,
      includeTags = [],
      excludeTags = [],
      contactsFrom,
      contactsTo,
      sendOption = "SCHEDULED",
      scheduledAt,
      speed = "SLOW",
      timezone = "Europe/Madrid",
      totalContacts = 0,
    } = body;

    // Validation
    if (!name || !deviceId || !messageBody) {
      return NextResponse.json(
        { error: "Missing required fields: name, deviceId, body" },
        { status: 400 }
      );
    }

    if (sendOption === "SCHEDULED" && !scheduledAt) {
      return NextResponse.json(
        { error: "scheduledAt is required when sendOption is SCHEDULED" },
        { status: 400 }
      );
    }

    // Determine initial status
    let status = "DRAFT";
    if (sendOption === "NOW") {
      status = "SENDING";
    } else if (sendOption === "SCHEDULED" && scheduledAt) {
      status = "SCHEDULED";
    }

    const massSend = await prisma.massSend.create({
      data: {
        name,
        deviceId,
        body: messageBody,
        mediaType,
        mediaUrl,
        includeTags: JSON.stringify(includeTags),
        excludeTags: JSON.stringify(excludeTags),
        contactsFrom: contactsFrom ? new Date(contactsFrom) : null,
        contactsTo: contactsTo ? new Date(contactsTo) : null,
        sendOption,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        speed,
        timezone,
        status,
        totalContacts,
      },
    });

    // TODO: If sendOption is NOW, trigger background job to start sending immediately
    // TODO: If sendOption is SCHEDULED, background worker should pick it up at scheduled time

    return NextResponse.json(massSend, { status: 201 });
  } catch (error) {
    console.error("Failed to create mass send:", error);
    return NextResponse.json(
      { error: "Failed to create mass send" },
      { status: 500 }
    );
  }
}
