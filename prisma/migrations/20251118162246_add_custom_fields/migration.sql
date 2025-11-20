-- CreateTable
CREATE TABLE "CustomField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContactCustomFieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "customFieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContactCustomFieldValue_customFieldId_fkey" FOREIGN KEY ("customFieldId") REFERENCES "CustomField" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomField_key_key" ON "CustomField"("key");

-- CreateIndex
CREATE INDEX "CustomField_key_idx" ON "CustomField"("key");

-- CreateIndex
CREATE INDEX "ContactCustomFieldValue_contactId_idx" ON "ContactCustomFieldValue"("contactId");

-- CreateIndex
CREATE INDEX "ContactCustomFieldValue_customFieldId_idx" ON "ContactCustomFieldValue"("customFieldId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactCustomFieldValue_contactId_customFieldId_key" ON "ContactCustomFieldValue"("contactId", "customFieldId");
