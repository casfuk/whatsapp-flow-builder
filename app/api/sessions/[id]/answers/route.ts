import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const body = await request.json();
  const { stepId, question, answer, tags } = body;

  // TEMP: not saving to DB yet, just echoing back
  console.log("Received answer", {
    sessionId,
    stepId,
    question,
    answer,
    tags,
  });

  return NextResponse.json({
    ok: true,
    sessionId,
    stepId,
    question,
    answer,
    tags,
  });
}
