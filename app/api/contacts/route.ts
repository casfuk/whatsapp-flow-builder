import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhoneNumber } from "@/lib/phone-utils";

// GET all contacts
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");

    let where: any = {};

    if (search) {
      where = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
          customValues: {
            include: {
              customField: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.contact.count({ where }),
    ]);

    // Format response
    const formattedContacts = contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      profileImageUrl: contact.profileImageUrl,
      notes: contact.notes,
      assignedAdminId: contact.assignedAdminId,
      source: contact.source,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
      tags: contact.tags.map((ct) => ct.tag),
      customValues: contact.customValues.map((cv) => ({
        id: cv.id,
        value: cv.value,
        fieldDef: {
          id: cv.customField.id,
          name: cv.customField.name,
          type: cv.customField.type,
        },
      })),
    }));

    return NextResponse.json({
      contacts: formattedContacts,
      total,
      page,
      pageSize,
    });
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
    const { phone, name, email, source, profileImageUrl } = body;

    if (!phone) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Normalize phone number to prevent duplicates
    const normalizedPhone = normalizePhoneNumber(phone);

    console.log(`[Contacts API] Creating/updating contact - Original: ${phone}, Normalized: ${normalizedPhone}`);

    // Upsert contact (create or update)
    // Manual contacts have deviceId = "" (empty string for non-WhatsApp contacts)
    const contact = await prisma.contact.upsert({
      where: {
        phone_device: {
          phone: normalizedPhone,
          deviceId: "",
        },
      },
      create: {
        phone: normalizedPhone,
        deviceId: "",
        name: name || null,
        email: email || null,
        profileImageUrl: profileImageUrl || null,
        source: source || "manual",
      },
      update: {
        name: name || undefined,
        email: email || undefined,
        profileImageUrl: profileImageUrl || undefined,
        updatedAt: new Date(),
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        customValues: {
          include: {
            customField: true,
          },
        },
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
