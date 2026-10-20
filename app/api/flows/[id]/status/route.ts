import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJson } from "@/lib/safe-response";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { isActive } = body;

    if (typeof isActive !== "boolean") {
      return safeJson(
        { error: "isActive must be a boolean" },
        { status: 400 }
      );
    }

    const flow = await prisma.flow.update({
      where: { id },
      data: { isActive },
    });

    return safeJson(flow);
  } catch (error: any) {
    console.error("Failed to update flow status:", error);
    return safeJson(
      {
        error: "Failed to update flow status",
        message: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
