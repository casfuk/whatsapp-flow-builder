import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Delete the device
    await prisma.device.delete({
      where: { id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to delete device:", error);
    return NextResponse.json(
      { error: "Failed to delete device" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, color } = body;

    const device = await prisma.device.update({
      where: { id },
      data: {
        name: name || undefined,
        color: color || undefined,
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
    });
  } catch (error) {
    console.error("Failed to update device:", error);
    return NextResponse.json(
      { error: "Failed to update device" },
      { status: 500 }
    );
  }
}
