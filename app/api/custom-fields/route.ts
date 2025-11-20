import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Helper function to slugify field name into a key
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special chars
    .replace(/[\s_-]+/g, "_") // Replace spaces/hyphens with underscore
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

export async function GET() {
  try {
    const fields = await prisma.customField.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(fields);
  } catch (error) {
    console.error("Failed to fetch custom fields:", error);
    return NextResponse.json(
      { error: "Failed to fetch custom fields" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "Field name is required" },
        { status: 400 }
      );
    }

    // Generate unique key from name
    const baseKey = slugify(name);
    let key = baseKey;
    let counter = 1;

    // Ensure key is unique
    while (await prisma.customField.findUnique({ where: { key } })) {
      key = `${baseKey}_${counter}`;
      counter++;
    }

    const field = await prisma.customField.create({
      data: {
        name: name.trim(),
        key,
        type: type || "text",
      },
    });

    return NextResponse.json(field, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create custom field:", error);
    return NextResponse.json(
      {
        error: "Failed to create custom field",
        message: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
