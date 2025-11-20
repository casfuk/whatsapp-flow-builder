import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET single contact
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contact = await prisma.contact.findUnique({
      where: { id },
    });

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(contact);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch contact" },
      { status: 500 }
    );
  }
}

// PUT update contact
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { phoneNumber, name, email, source, tags } = body;

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        ...(phoneNumber !== undefined && { phoneNumber }),
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(source !== undefined && { source }),
        ...(tags !== undefined && { tags: JSON.stringify(tags) }),
      },
    });

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Failed to update contact:", error);
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    );
  }
}

// DELETE contact
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.contact.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 }
    );
  }
}
