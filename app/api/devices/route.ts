import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const devices = await prisma.device.findMany({
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        isConnected: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Format devices for the response with alias and online status
    const formattedDevices = devices.map(device => ({
      id: device.id,
      alias: device.name,
      phoneNumber: device.phoneNumber || "",
      isOnline: device.isConnected,
    }));

    return NextResponse.json({ devices: formattedDevices });
  } catch (error) {
    console.error("Failed to fetch devices:", error);
    return NextResponse.json({ error: "Failed to fetch devices" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, whatsappPhoneNumberId, accessToken, businessAccountId, phoneNumber, color } = body;

    if (!name || !whatsappPhoneNumberId || !accessToken) {
      return NextResponse.json(
        { error: "Name, Phone Number ID, and Access Token are required" },
        { status: 400 }
      );
    }

    // Create new device
    const device = await prisma.device.create({
      data: {
        name,
        whatsappPhoneNumberId,
        accessToken,
        businessAccountId,
        phoneNumber,
        color: color || "#6D5BFA",
        isConnected: true, // Assume connected when created via API setup
      },
    });

    return NextResponse.json({
      id: device.id,
      alias: device.name,
      phoneNumber: device.phoneNumber || "",
      isOnline: device.isConnected,
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to create device:", error);
    return NextResponse.json(
      { error: "Failed to create device" },
      { status: 500 }
    );
  }
}
