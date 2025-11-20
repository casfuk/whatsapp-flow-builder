import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // TEMP: not loading from DB yet
  console.log("Fetch session called for id:", id);

  return NextResponse.json({
    ok: true,
    sessionId: id,
    message: "Session loading via stub. DB session model not implemented yet.",
  });
}
