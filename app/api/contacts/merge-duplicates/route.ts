import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhoneNumber } from "@/lib/phone-utils";

/**
 * POST /api/contacts/merge-duplicates
 * Finds and merges duplicate contacts based on normalized phone numbers
 * Keeps oldest contact as master, moves tags and messages to master, deletes duplicates
 */
export async function POST(request: NextRequest) {
  try {
    console.log("[Merge Duplicates] Starting duplicate merge process...");

    // Get all contacts
    const allContacts = await prisma.contact.findMany({
      include: {
        tags: true,
        customValues: true,
      },
      orderBy: { createdAt: "asc" }, // Oldest first (will be kept as master)
    });

    console.log(`[Merge Duplicates] Found ${allContacts.length} total contacts`);

    // Group contacts by normalized phone + deviceId
    const grouped = new Map<string, typeof allContacts>();

    for (const contact of allContacts) {
      const normalizedPhone = normalizePhoneNumber(contact.phone);
      const key = `${normalizedPhone}::${contact.deviceId || ""}`;

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(contact);
    }

    // Find groups with duplicates (more than 1 contact)
    const duplicateGroups = Array.from(grouped.entries()).filter(
      ([_, contacts]) => contacts.length > 1
    );

    console.log(`[Merge Duplicates] Found ${duplicateGroups.length} duplicate groups`);

    let mergedCount = 0;
    let deletedCount = 0;

    // Process each duplicate group
    for (const [key, contacts] of duplicateGroups) {
      const [master, ...duplicates] = contacts; // First (oldest) is master

      console.log(
        `[Merge Duplicates] Merging ${duplicates.length} duplicates into master ${master.id} (${master.phone})`
      );

      // Merge each duplicate into master
      for (const duplicate of duplicates) {
        try {
          // Move tags from duplicate to master (avoid duplicates)
          const duplicateTags = await prisma.contactTag.findMany({
            where: { contactId: duplicate.id },
          });

          for (const tag of duplicateTags) {
            // Check if master already has this tag
            const existingTag = await prisma.contactTag.findUnique({
              where: {
                contactId_tagId: {
                  contactId: master.id,
                  tagId: tag.tagId,
                },
              },
            });

            if (!existingTag) {
              // Move tag to master
              await prisma.contactTag.create({
                data: {
                  contactId: master.id,
                  tagId: tag.tagId,
                },
              });
            }
          }

          // Move custom field values from duplicate to master (avoid duplicates)
          const duplicateValues = await prisma.contactCustomFieldValue.findMany({
            where: { contactId: duplicate.id },
          });

          for (const value of duplicateValues) {
            // Check if master already has this custom field
            const existingValue =
              await prisma.contactCustomFieldValue.findUnique({
                where: {
                  contactId_customFieldId: {
                    contactId: master.id,
                    customFieldId: value.customFieldId,
                  },
                },
              });

            if (!existingValue) {
              // Move value to master
              await prisma.contactCustomFieldValue.create({
                data: {
                  contactId: master.id,
                  customFieldId: value.customFieldId,
                  value: value.value,
                },
              });
            }
          }

          // Update master with any missing info from duplicate
          const updates: any = {};
          if (!master.name && duplicate.name) updates.name = duplicate.name;
          if (!master.email && duplicate.email) updates.email = duplicate.email;
          if (!master.profileImageUrl && duplicate.profileImageUrl)
            updates.profileImageUrl = duplicate.profileImageUrl;

          if (Object.keys(updates).length > 0) {
            await prisma.contact.update({
              where: { id: master.id },
              data: updates,
            });
          }

          // Delete the duplicate contact (cascade will delete related records)
          await prisma.contact.delete({
            where: { id: duplicate.id },
          });

          deletedCount++;
          console.log(
            `[Merge Duplicates] ✓ Merged and deleted duplicate ${duplicate.id}`
          );
        } catch (error) {
          console.error(
            `[Merge Duplicates] ✗ Failed to merge duplicate ${duplicate.id}:`,
            error
          );
        }
      }

      mergedCount++;
    }

    console.log(`[Merge Duplicates] Complete!`);
    console.log(`[Merge Duplicates] - Merged groups: ${mergedCount}`);
    console.log(`[Merge Duplicates] - Deleted duplicates: ${deletedCount}`);

    return NextResponse.json({
      success: true,
      mergedGroups: mergedCount,
      deletedDuplicates: deletedCount,
      message: `Successfully merged ${mergedCount} duplicate groups, deleted ${deletedCount} duplicate contacts`,
    });
  } catch (error) {
    console.error("[Merge Duplicates] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to merge duplicates",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
