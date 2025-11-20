import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all contacts
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");

    let where: any = {};

    if (search) {
      where = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { phoneNumber: { contains: search } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(contacts);
  } catch (error) {
    console.error("Failed to fetch contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

// POST create new contact
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, name, email, source, tags } = body;

    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Check if contact already exists
    const existingContact = await prisma.contact.findUnique({
      where: { phoneNumber },
    });

    if (existingContact) {
      return NextResponse.json(
        { error: "Contact with this phone number already exists" },
        { status: 400 }
      );
    }

    const contact = await prisma.contact.create({
      data: {
        phoneNumber,
        name: name || null,
        email: email || null,
        source: source || "manual",
        tags: tags ? JSON.stringify(tags) : "[]",
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("Failed to create contact:", error);
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}
