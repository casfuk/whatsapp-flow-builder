import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { safeJson } from "@/lib/safe-response";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return safeJson(
        { error: "No file received" },
        { status: 400 }
      );
    }

    const mimeType = file.type || "application/octet-stream";
    const originalFileName = file.name || "uploaded-file";

    // Generate unique filename: timestamp-uuid-originalname
    const timestamp = Date.now();
    const uuid = crypto.randomUUID();
    const uniqueFileName = `${timestamp}-${uuid}-${originalFileName}`;

    console.log(`[/api/upload] ========================================`);
    console.log(`[/api/upload] 📤 UPLOADING FILE TO VERCEL BLOB`);
    console.log(`[/api/upload] Original file name: ${originalFileName}`);
    console.log(`[/api/upload] Unique file name: ${uniqueFileName}`);
    console.log(`[/api/upload] File type: ${mimeType}`);
    console.log(`[/api/upload] File size: ${file.size} bytes`);

    // Extra validation for audio files
    if (originalFileName.endsWith('.mp3') || originalFileName.endsWith('.ogg') || originalFileName.endsWith('.m4a') || originalFileName.endsWith('.aac') || originalFileName.endsWith('.amr') || mimeType.startsWith('audio/')) {
      console.log(`[/api/upload] 🎵 AUDIO FILE DETECTED`);
      console.log(`[/api/upload] Extension: ${originalFileName.split('.').pop()}`);
      console.log(`[/api/upload] MIME Type: ${mimeType}`);

      // WhatsApp-supported audio formats
      const whatsappSupportedAudio = [
        'audio/ogg',
        'audio/mpeg',  // MP3
        'audio/mp4',   // M4A
        'audio/aac',
        'audio/amr'
      ];

      const isWhatsAppCompatible = whatsappSupportedAudio.some(type => mimeType.includes(type));

      if (mimeType.includes('mpeg') || originalFileName.endsWith('.mp3')) {
        console.log(`[/api/upload] ✅ MP3 audio detected - WhatsApp-compatible format!`);
      } else if (mimeType.includes('ogg') && mimeType.includes('opus')) {
        console.log(`[/api/upload] ✅ OGG/Opus audio - WhatsApp-compatible format!`);
      } else if (isWhatsAppCompatible) {
        console.log(`[/api/upload] ✅ WhatsApp-compatible audio: ${mimeType}`);
      } else {
        console.log(`[/api/upload] ⚠️ Audio format may not be supported by WhatsApp: ${mimeType}`);
      }
    }

    // Upload to Vercel Blob Storage with unique filename
    const blob = await put(uniqueFileName, file, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: false, // We already have unique filename
    });

    console.log(`[/api/upload] ✅ Upload successful!`);
    console.log(`[/api/upload] Public URL: ${blob.url}`);
    console.log(`[/api/upload] ========================================`);

    return safeJson(
      {
        url: blob.url,
        fileName: originalFileName, // Return original name for display
        mimeType: mimeType,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[/api/upload] ❌ Upload error:", err);
    console.error("[/api/upload] Error message:", err.message);
    console.error("[/api/upload] Error stack:", err.stack);
    return safeJson(
      { error: "Upload failed", details: err.message },
      { status: 500 }
    );
  }
}
