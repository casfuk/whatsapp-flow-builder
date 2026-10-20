import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJson } from "@/lib/safe-response";

export async function GET() {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return safeJson(tags);
  } catch (error) {
    console.error("Failed to fetch tags:", error);
    return safeJson(
      { error: "Failed to fetch tags" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, color } = body;

    if (!name || name.trim() === "") {
      return safeJson(
        { error: "Tag name is required" },
        { status: 400 }
      );
    }

    // Check if tag with same name already exists
    const existing = await prisma.tag.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return safeJson(
        { error: "A tag with this name already exists" },
        { status: 409 }
      );
    }

    const tag = await prisma.tag.create({
      data: {
        name: name.trim(),
        color: color || "#6D5BFA",
      },
    });

    return safeJson(tag, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create tag:", error);
    return safeJson(
      {
        error: "Failed to create tag",
        message: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
