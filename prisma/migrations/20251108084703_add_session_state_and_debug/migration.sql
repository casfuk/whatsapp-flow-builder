-- CreateTable
CREATE TABLE "SessionState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "currentStepId" TEXT,
    "variablesJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DebugAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionData" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionState_sessionId_key" ON "SessionState"("sessionId");

-- CreateIndex
CREATE INDEX "SessionState_sessionId_idx" ON "SessionState"("sessionId");

-- CreateIndex
CREATE INDEX "SessionState_flowId_idx" ON "SessionState"("flowId");

-- CreateIndex
CREATE INDEX "DebugAction_sessionId_idx" ON "DebugAction"("sessionId");
