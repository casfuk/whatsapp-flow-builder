import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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

    // Generate unique filename
    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ext = path.extname(fileName);
    const uniqueFileName = `${uniqueId}${ext}`;

    // Save to public/uploads directory
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, uniqueFileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await writeFile(filePath, buffer);
    console.log(`[/api/upload] File saved: ${uniqueFileName} (${mimeType})`);

    // Return public URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.headers.get("origin") || "http://localhost:3000";
    const publicUrl = `${baseUrl}/uploads/${uniqueFileName}`;

    return NextResponse.json(
      {
        url: publicUrl,
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
