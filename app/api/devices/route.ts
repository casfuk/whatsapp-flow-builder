import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJson } from "@/lib/safe-response";

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
        accessToken: true, // read only to derive hasAccessToken, never returned
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
      hasAccessToken: !!device.accessToken,
      businessAccountId: device.businessAccountId,
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
    }));

    return safeJson({ devices: formattedDevices });
  } catch (error) {
    console.error("Failed to fetch devices:", error);
    return safeJson({ error: "Failed to fetch devices" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, whatsappPhoneNumberId, accessToken, businessAccountId, phoneNumber, color } = body;

    if (!name || !whatsappPhoneNumberId || !accessToken) {
      return safeJson(
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
      return safeJson(
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

    // Also create/update WhatsAppConfig for flow engine
    // Find existing cloud_api config or create new one
    const existingConfig = await prisma.whatsAppConfig.findFirst({
      where: { mode: "cloud_api" },
    });

    if (existingConfig) {
      await prisma.whatsAppConfig.update({
        where: { id: existingConfig.id },
        data: {
          phoneNumber: phoneNumber,
          phoneNumberId: whatsappPhoneNumberId,
          wabaId: businessAccountId,
          accessToken: accessToken,
        },
      });
    } else {
      await prisma.whatsAppConfig.create({
        data: {
          mode: "cloud_api",
          phoneNumber: phoneNumber,
          phoneNumberId: whatsappPhoneNumberId,
          wabaId: businessAccountId,
          accessToken: accessToken,
        },
      });
    }

    return safeJson({
      id: device.id,
      name: device.name,
      phoneNumber: device.phoneNumber || "",
      isConnected: device.isConnected,
      color: device.color || "#6D5BFA",
      whatsappPhoneNumberId: device.whatsappPhoneNumberId,
      hasAccessToken: !!device.accessToken,
      businessAccountId: device.businessAccountId,
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to create device:", error);
    return safeJson(
      { error: "Failed to create device" },
      { status: 500 }
    );
  }
}
