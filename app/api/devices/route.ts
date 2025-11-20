import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all devices
export async function GET() {
  try {
    const devices = await prisma.device.findMany({
      orderBy: { createdAt: "asc" },
    });

    // Always return an array
    return NextResponse.json(Array.isArray(devices) ? devices : [], {
      status: 200,
    });
  } catch (error) {
    console.error("Failed to fetch devices:", error);
    // IMPORTANT: do NOT return 500 here – just an empty array
    return NextResponse.json([], { status: 200 });
  }
}

// POST create new device
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      color,
      whatsappPhoneNumberId,
      phoneNumber,
      accessToken,
      businessAccountId,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // If WhatsApp credentials provided, test the connection
    let isConnected = false;
    if (whatsappPhoneNumberId && accessToken) {
      try {
        const testResponse = await fetch(
          `https://graph.facebook.com/v17.0/${whatsappPhoneNumberId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (testResponse.ok) {
          isConnected = true;
        } else {
          const errorData = await testResponse.json();
          return NextResponse.json(
            {
              error: "Invalid WhatsApp credentials",
              details: errorData.error?.message,
            },
            { status: 400 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          { error: "Failed to verify WhatsApp credentials" },
          { status: 400 }
        );
      }
    }

    const device = await prisma.device.create({
      data: {
        name,
        color: color || "#6D5BFA",
        whatsappPhoneNumberId,
        phoneNumber,
        accessToken,
        businessAccountId,
        isConnected,
      },
    });

    return NextResponse.json(device, { status: 201 });
  } catch (error) {
    console.error("Failed to create device:", error);
    return NextResponse.json(
      { error: "Failed to create device" },
      { status: 500 }
    );
  }
}
