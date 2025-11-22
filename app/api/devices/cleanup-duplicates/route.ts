import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // Fetch all devices
    const devices = await prisma.device.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Group devices by whatsappPhoneNumberId
    const devicesByPhoneId = new Map<string, typeof devices>();

    for (const device of devices) {
      if (!device.whatsappPhoneNumberId) continue;

      const existing = devicesByPhoneId.get(device.whatsappPhoneNumberId);
      if (!existing) {
        devicesByPhoneId.set(device.whatsappPhoneNumberId, [device]);
      } else {
        existing.push(device);
      }
    }

    // Find duplicates and delete all but the most recent
    const deletedDevices: string[] = [];

    for (const [phoneId, deviceList] of devicesByPhoneId) {
      if (deviceList.length > 1) {
        // Sort by createdAt descending (most recent first)
        const sorted = deviceList.sort((a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime()
        );

        // Keep the first (most recent), delete the rest
        const [keep, ...toDelete] = sorted;

        for (const device of toDelete) {
          await prisma.device.delete({
            where: { id: device.id },
          });
          deletedDevices.push(`${device.name} (${device.whatsappPhoneNumberId})`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: deletedDevices.length > 0
        ? `Deleted ${deletedDevices.length} duplicate device(s)`
        : "No duplicates found",
      deletedDevices,
    });
  } catch (error) {
    console.error("Failed to cleanup duplicates:", error);
    return NextResponse.json(
      { error: "Failed to cleanup duplicates" },
      { status: 500 }
    );
  }
}
