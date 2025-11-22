-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "contactName" TEXT,
    "lastMessagePreview" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "deviceId" TEXT NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "assignedToUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Chat_phoneNumber_idx" ON "Chat"("phoneNumber");

-- CreateIndex
CREATE INDEX "Chat_deviceId_idx" ON "Chat"("deviceId");

-- CreateIndex
CREATE INDEX "Chat_status_idx" ON "Chat"("status");

-- CreateIndex
CREATE INDEX "Chat_assignedToUserId_idx" ON "Chat"("assignedToUserId");

-- CreateIndex
CREATE INDEX "Chat_lastMessageAt_idx" ON "Chat"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Chat_isFavorite_idx" ON "Chat"("isFavorite");

-- CreateIndex
CREATE UNIQUE INDEX "Chat_phoneNumber_deviceId_key" ON "Chat"("phoneNumber", "deviceId");
