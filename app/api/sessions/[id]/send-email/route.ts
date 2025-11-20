import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { to, subject, message } = body;

  // TEMP: no DB lookup, no real email yet
  console.log("Send email stub called:", {
    sessionId: id,
    to,
    subject,
    message,
  });

  return NextResponse.json({
    ok: true,
    sessionId: id,
    to,
    subject,
    message,
    note: "Email sending not wired up yet – this is a stub response.",
  });
}
