-- CreateTable
CREATE TABLE "MassSend" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'NONE',
    "mediaUrl" TEXT,
    "includeTags" TEXT NOT NULL DEFAULT '[]',
    "excludeTags" TEXT NOT NULL DEFAULT '[]',
    "contactsFrom" TIMESTAMP(3),
    "contactsTo" TIMESTAMP(3),
    "sendOption" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3),
    "speed" TEXT NOT NULL DEFAULT 'SLOW',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Madrid',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalContacts" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MassSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MassSend_deviceId_idx" ON "MassSend"("deviceId");

-- CreateIndex
CREATE INDEX "MassSend_status_idx" ON "MassSend"("status");

-- CreateIndex
CREATE INDEX "MassSend_scheduledAt_idx" ON "MassSend"("scheduledAt");
