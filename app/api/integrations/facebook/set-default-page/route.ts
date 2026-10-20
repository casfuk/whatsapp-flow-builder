import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJson } from "@/lib/safe-response";

export async function POST(request: NextRequest) {
  const { pageId } = await request.json();

  if (!pageId) {
    return safeJson({ error: "pageId required" }, { status: 400 });
  }

  // Unset all defaults
  await prisma.facebookPageConnection.updateMany({
    where: { isDefault: true },
    data: { isDefault: false },
  });

  // Set new default
  await prisma.facebookPageConnection.update({
    where: { pageId },
    data: { isDefault: true },
  });

  return safeJson({ success: true });
}
