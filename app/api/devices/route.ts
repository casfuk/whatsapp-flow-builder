import { NextResponse } from "next/server";
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
