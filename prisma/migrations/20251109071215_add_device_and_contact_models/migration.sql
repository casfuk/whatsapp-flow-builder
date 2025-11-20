-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6D5BFA',
    "whatsappPhoneNumberId" TEXT,
    "phoneNumber" TEXT,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "accessToken" TEXT,
    "businessAccountId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneNumber" TEXT NOT NULL,
    "name" TEXT,
    "profilePic" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Device_isConnected_idx" ON "Device"("isConnected");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_phoneNumber_key" ON "Contact"("phoneNumber");

-- CreateIndex
CREATE INDEX "Contact_phoneNumber_idx" ON "Contact"("phoneNumber");
