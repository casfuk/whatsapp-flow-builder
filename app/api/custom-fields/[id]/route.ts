import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete the field (cascade will delete associated values)
    await prisma.customField.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete custom field:", error);
    return NextResponse.json(
      {
        error: "Failed to delete custom field",
        message: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
