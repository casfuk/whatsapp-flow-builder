-- CreateTable
CREATE TABLE "Flow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "startStepId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FlowStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "flowId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "positionX" INTEGER NOT NULL DEFAULT 0,
    "positionY" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "FlowStep_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FlowConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "flowId" TEXT NOT NULL,
    "fromStepId" TEXT NOT NULL,
    "toStepId" TEXT NOT NULL,
    "conditionLabel" TEXT,
    CONSTRAINT "FlowConnection_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FlowConnection_fromStepId_fkey" FOREIGN KEY ("fromStepId") REFERENCES "FlowStep" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FlowConnection_toStepId_fkey" FOREIGN KEY ("toStepId") REFERENCES "FlowStep" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "flowId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "answersJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FormAnswer_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Flow_key_key" ON "Flow"("key");

-- CreateIndex
CREATE INDEX "Flow_key_idx" ON "Flow"("key");

-- CreateIndex
CREATE INDEX "FlowStep_flowId_idx" ON "FlowStep"("flowId");

-- CreateIndex
CREATE INDEX "FlowConnection_flowId_idx" ON "FlowConnection"("flowId");

-- CreateIndex
CREATE INDEX "FlowConnection_fromStepId_idx" ON "FlowConnection"("fromStepId");

-- CreateIndex
CREATE INDEX "FlowConnection_toStepId_idx" ON "FlowConnection"("toStepId");

-- CreateIndex
CREATE INDEX "FormAnswer_flowId_idx" ON "FormAnswer"("flowId");

-- CreateIndex
CREATE INDEX "FormAnswer_sessionId_idx" ON "FormAnswer"("sessionId");
