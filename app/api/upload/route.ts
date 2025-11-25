import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

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
    const fileName = file.name || "uploaded-file";

    console.log(`[/api/upload] ========================================`);
    console.log(`[/api/upload] 📤 UPLOADING FILE TO VERCEL BLOB`);
    console.log(`[/api/upload] File name: ${fileName}`);
    console.log(`[/api/upload] File type: ${mimeType}`);
    console.log(`[/api/upload] File size: ${file.size} bytes`);

    // Upload to Vercel Blob Storage
    const blob = await put(fileName, file, {
      access: "public",
      contentType: mimeType,
    });

    console.log(`[/api/upload] ✅ Upload successful!`);
    console.log(`[/api/upload] Public URL: ${blob.url}`);
    console.log(`[/api/upload] ========================================`);

    return NextResponse.json(
      {
        url: blob.url,
        fileName: fileName,
        mimeType: mimeType,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[/api/upload] ❌ Upload error:", err);
    console.error("[/api/upload] Error message:", err.message);
    console.error("[/api/upload] Error stack:", err.stack);
    return NextResponse.json(
      { error: "Upload failed", details: err.message },
      { status: 500 }
    );
  }
}
