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
        color: true,
        whatsappPhoneNumberId: true,
        accessToken: true,
        businessAccountId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Return devices with consistent field names
    const formattedDevices = devices.map(device => ({
      id: device.id,
      name: device.name,
      phoneNumber: device.phoneNumber || "",
      isConnected: device.isConnected,
      color: device.color || "#6D5BFA",
      whatsappPhoneNumberId: device.whatsappPhoneNumberId,
      accessToken: device.accessToken,
      businessAccountId: device.businessAccountId,
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
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

    // Check for existing device with same phone number ID to prevent duplicates
    const existingDevice = await prisma.device.findFirst({
      where: {
        OR: [
          { whatsappPhoneNumberId },
          { phoneNumber: phoneNumber || undefined },
        ],
      },
    });

    if (existingDevice) {
      return NextResponse.json(
        { error: "A device with this phone number already exists" },
        { status: 409 }
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
      name: device.name,
      phoneNumber: device.phoneNumber || "",
      isConnected: device.isConnected,
      color: device.color || "#6D5BFA",
      whatsappPhoneNumberId: device.whatsappPhoneNumberId,
      accessToken: device.accessToken,
      businessAccountId: device.businessAccountId,
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to create device:", error);
    return NextResponse.json(
      { error: "Failed to create device" },
      { status: 500 }
    );
  }
}
