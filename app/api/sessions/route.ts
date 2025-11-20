import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const flowId = searchParams.get("flowId");
  const phoneNumber = searchParams.get("phoneNumber");

  // TEMP: not loading from DB yet
  console.log("List sessions stub called:", {
    flowId,
    phoneNumber,
  });

  return NextResponse.json({
    ok: true,
    sessions: [],
    note: "Session listing stub. DB session model not implemented yet.",
  });
}
