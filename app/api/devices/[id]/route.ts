import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET single device
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const device = await prisma.device.findUnique({
      where: { id },
    });

    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    return NextResponse.json(device);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch device" },
      { status: 500 }
    );
  }
}

// PUT update device
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      color,
      whatsappPhoneNumberId,
      phoneNumber,
      accessToken,
      businessAccountId,
      isConnected,
    } = body;

    // If trying to connect, verify credentials first
    if (isConnected && whatsappPhoneNumberId && accessToken) {
      try {
        const testResponse = await fetch(
          `https://graph.facebook.com/v17.0/${whatsappPhoneNumberId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!testResponse.ok) {
          const errorData = await testResponse.json();
          return NextResponse.json(
            {
              error: "Cannot connect: Invalid WhatsApp credentials",
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

    const device = await prisma.device.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
        ...(whatsappPhoneNumberId !== undefined && { whatsappPhoneNumberId }),
        ...(phoneNumber !== undefined && { phoneNumber }),
        ...(accessToken !== undefined && { accessToken }),
        ...(businessAccountId !== undefined && { businessAccountId }),
        ...(isConnected !== undefined && { isConnected }),
      },
    });

    return NextResponse.json(device);
  } catch (error) {
    console.error("Failed to update device:", error);
    return NextResponse.json(
      { error: "Failed to update device" },
      { status: 500 }
    );
  }
}

// DELETE device
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.device.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete device" },
      { status: 500 }
    );
  }
}
