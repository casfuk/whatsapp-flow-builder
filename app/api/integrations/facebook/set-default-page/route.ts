import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const { pageId } = await request.json();

  if (!pageId) {
    return NextResponse.json({ error: "pageId required" }, { status: 400 });
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

  return NextResponse.json({ success: true });
}
