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

    const mimeType = file.type || "application/octet-stream";
    const fileName = file.name || "upload.bin";

    // Generate unique ID for file
    const fileId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // TODO: Replace with real storage (S3, Cloudinary, etc.)
    // For now, return a mock ID that the pipeline can use
    console.log(`[/api/upload] File received: ${fileName} (${mimeType})`);

    return NextResponse.json(
      {
        fileId,
        mimeType,
        fileName,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[/api/upload] Error:", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
