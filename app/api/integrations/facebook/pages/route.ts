import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const pages = await prisma.facebookPageConnection.findMany({
    orderBy: { createdAt: "desc" },
  });

  const account = await prisma.facebookAccount.findFirst();

  return NextResponse.json({
    connected: !!account,
    pages,
  });
}
