-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FacebookAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "facebookUserId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FacebookPageConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "pageAccessToken" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_phone_key" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "MessageLog_phone_idx" ON "MessageLog"("phone");

-- CreateIndex
CREATE INDEX "MessageLog_createdAt_idx" ON "MessageLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FacebookAccount_facebookUserId_key" ON "FacebookAccount"("facebookUserId");

-- CreateIndex
CREATE INDEX "FacebookAccount_userId_idx" ON "FacebookAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FacebookPageConnection_pageId_key" ON "FacebookPageConnection"("pageId");

-- CreateIndex
CREATE INDEX "FacebookPageConnection_workspaceId_idx" ON "FacebookPageConnection"("workspaceId");

-- CreateIndex
CREATE INDEX "FacebookPageConnection_isDefault_idx" ON "FacebookPageConnection"("isDefault");
