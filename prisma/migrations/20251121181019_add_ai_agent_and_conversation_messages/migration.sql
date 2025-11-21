-- AlterTable
ALTER TABLE "SessionState" ADD COLUMN     "aiTurnCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "assigneeType" TEXT;

-- CreateTable
CREATE TABLE "AiAgent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT NOT NULL DEFAULT 'es',
    "tone" TEXT NOT NULL DEFAULT 'professional',
    "goal" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "maxTurns" INTEGER NOT NULL DEFAULT 10,
    "createdById" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "senderId" TEXT,
    "message" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiAgent_isActive_idx" ON "AiAgent"("isActive");

-- CreateIndex
CREATE INDEX "AiAgent_createdById_idx" ON "AiAgent"("createdById");

-- CreateIndex
CREATE INDEX "ConversationMessage_sessionId_idx" ON "ConversationMessage"("sessionId");

-- CreateIndex
CREATE INDEX "ConversationMessage_senderType_idx" ON "ConversationMessage"("senderType");

-- CreateIndex
CREATE INDEX "ConversationMessage_createdAt_idx" ON "ConversationMessage"("createdAt");

-- CreateIndex
CREATE INDEX "SessionState_assigneeType_idx" ON "SessionState"("assigneeType");
