-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Flow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startStepId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Flow" ("createdAt", "description", "id", "key", "name", "startStepId", "updatedAt") SELECT "createdAt", "description", "id", "key", "name", "startStepId", "updatedAt" FROM "Flow";
DROP TABLE "Flow";
ALTER TABLE "new_Flow" RENAME TO "Flow";
CREATE UNIQUE INDEX "Flow_key_key" ON "Flow"("key");
CREATE INDEX "Flow_key_idx" ON "Flow"("key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
