-- CreateTable
CREATE TABLE "Whalink" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "fullUrl" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "presetMessage" TEXT NOT NULL,
    "image" TEXT,
    "description" TEXT,
    "emailKey" TEXT,
    "nameKey" TEXT,
    "trackingPixel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Whalink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Whalink_slug_key" ON "Whalink"("slug");

-- CreateIndex
CREATE INDEX "Whalink_slug_idx" ON "Whalink"("slug");

-- CreateIndex
CREATE INDEX "Whalink_deviceId_idx" ON "Whalink"("deviceId");
