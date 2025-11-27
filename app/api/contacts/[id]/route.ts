import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhoneNumber } from "@/lib/phone-utils";

// GET single contact
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contact = await prisma.contact.findUnique({
      where: { id },
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

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // Format response
    const formattedContact = {
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
    };

    return NextResponse.json(formattedContact);
  } catch (error) {
    console.error("Failed to fetch contact:", error);
    return NextResponse.json(
      { error: "Failed to fetch contact" },
      { status: 500 }
    );
  }
}

// PUT update contact (used by frontend edit modal)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, phoneNumber, email } = body;

    // Build update object
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;

    // Handle phone number update with normalization
    if (phoneNumber !== undefined && phoneNumber !== null && phoneNumber.trim() !== "") {
      const normalizedPhone = normalizePhoneNumber(phoneNumber);

      // Check if phone is being changed
      const currentContact = await prisma.contact.findUnique({
        where: { id },
        select: { phone: true, deviceId: true },
      });

      if (currentContact && currentContact.phone !== normalizedPhone) {
        // Phone is changing - check for conflicts with unique constraint
        const conflictingContact = await prisma.contact.findUnique({
          where: {
            phone_device: {
              phone: normalizedPhone,
              deviceId: currentContact.deviceId || "",
            },
          },
        });

        if (conflictingContact && conflictingContact.id !== id) {
          return NextResponse.json(
            { error: "Ya existe un contacto con este número de teléfono en este dispositivo" },
            { status: 409 }
          );
        }

        updateData.phone = normalizedPhone;
      }
    }

    // Update contact
    const updatedContact = await prisma.contact.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedContact);
  } catch (error: any) {
    console.error("Failed to update contact:", error);

    // Handle unique constraint violation
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe un contacto con este número de teléfono" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    );
  }
}

// PATCH update contact
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, notes, assignedAdminId, tagIds, customValues } = body;

    // Update basic contact info
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (notes !== undefined) updateData.notes = notes;
    if (assignedAdminId !== undefined) updateData.assignedAdminId = assignedAdminId;

    await prisma.contact.update({
      where: { id },
      data: updateData,
    });

    // Update tags if provided
    if (tagIds !== undefined && Array.isArray(tagIds)) {
      // Delete existing tags
      await prisma.contactTag.deleteMany({
        where: { contactId: id },
      });

      // Create new tag associations
      if (tagIds.length > 0) {
        await prisma.contactTag.createMany({
          data: tagIds.map((tagId: string) => ({
            contactId: id,
            tagId,
          })),
        });
      }
    }

    // Update custom field values if provided
    if (customValues !== undefined && Array.isArray(customValues)) {
      for (const cv of customValues) {
        if (cv.id) {
          // Update existing
          await prisma.contactCustomFieldValue.update({
            where: { id: cv.id },
            data: { value: cv.value },
          });
        } else if (cv.customFieldId && cv.value) {
          // Create new
          await prisma.contactCustomFieldValue.upsert({
            where: {
              contactId_customFieldId: {
                contactId: id,
                customFieldId: cv.customFieldId,
              },
            },
            create: {
              contactId: id,
              customFieldId: cv.customFieldId,
              value: cv.value,
            },
            update: {
              value: cv.value,
            },
          });
        }
      }
    }

    // Fetch updated contact with relations
    const updatedContact = await prisma.contact.findUnique({
      where: { id },
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

    return NextResponse.json(updatedContact);
  } catch (error) {
    console.error("Failed to update contact:", error);
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    );
  }
}

// DELETE contact
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.contact.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete contact:", error);
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 }
    );
  }
}
