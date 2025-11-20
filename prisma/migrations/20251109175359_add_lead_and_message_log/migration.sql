-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneNumber" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "profilePic" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Contact" ("createdAt", "id", "metadata", "name", "phoneNumber", "profilePic", "updatedAt") SELECT "createdAt", "id", "metadata", "name", "phoneNumber", "profilePic", "updatedAt" FROM "Contact";
DROP TABLE "Contact";
ALTER TABLE "new_Contact" RENAME TO "Contact";
CREATE UNIQUE INDEX "Contact_phoneNumber_key" ON "Contact"("phoneNumber");
CREATE INDEX "Contact_phoneNumber_idx" ON "Contact"("phoneNumber");
CREATE INDEX "Contact_source_idx" ON "Contact"("source");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
