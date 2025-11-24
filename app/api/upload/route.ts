import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file received" },
        { status: 400 }
      );
    }

    // TEMPORARY: ignore the actual file and just return a public URL
    // so the rest of the flow (MessageNode + send_whatsapp_media) works.
    const mimeType = file.type || "application/octet-stream";

    // Choose a different demo URL depending on type
    let demoUrl = "https://via.placeholder.com/512"; // default image
    if (mimeType.startsWith("audio/")) {
      demoUrl =
        "https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav";
    } else if (
      mimeType === "application/pdf" ||
      mimeType.includes("officedocument") ||
      mimeType.includes("msword")
    ) {
      demoUrl =
        "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
    }

    console.log(`[/api/upload] File received: ${file.name} (${mimeType})`);
    console.log(`[/api/upload] Returning demo URL: ${demoUrl}`);

    return NextResponse.json(
      {
        url: demoUrl,
        fileName: file.name || "demo-file",
        mimeType,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[/api/upload] Uncaught error:", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
