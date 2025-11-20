-- CreateTable
CREATE TABLE "WhatsAppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT,
    "mode" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "phoneNumberId" TEXT,
    "wabaId" TEXT,
    "accessToken" TEXT,
    "sessionId" TEXT,
    "sessionState" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "WhatsAppConfig_workspaceId_idx" ON "WhatsAppConfig"("workspaceId");

-- CreateIndex
CREATE INDEX "WhatsAppConfig_mode_idx" ON "WhatsAppConfig"("mode");
