import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJson } from "@/lib/safe-response";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.tag.delete({
      where: { id },
    });

    return safeJson({ success: true });
  } catch (error: any) {
    console.error("Failed to delete tag:", error);
    return safeJson(
      {
        error: "Failed to delete tag",
        message: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
