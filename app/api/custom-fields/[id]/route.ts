import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJson } from "@/lib/safe-response";

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

    return safeJson({ success: true });
  } catch (error: any) {
    console.error("Failed to delete custom field:", error);
    return safeJson(
      {
        error: "Failed to delete custom field",
        message: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
