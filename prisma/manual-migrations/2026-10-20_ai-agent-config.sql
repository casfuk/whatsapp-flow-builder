-- Applied to production on 2026-10-20 (additive only): per-agent AI configuration and per-conversation AI context.
-- AlterTable
ALTER TABLE "AiAgent" ADD COLUMN     "fallbackMessage" TEXT,
ADD COLUMN     "followupDelayMinutes" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "followupEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "followupMessages" TEXT,
ADD COLUMN     "handoverPhone" TEXT,
ADD COLUMN     "knowledge" TEXT,
ADD COLUMN     "maxTokens" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN     "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'openai',
ADD COLUMN     "rules" TEXT,
ADD COLUMN     "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7;

-- AlterTable
ALTER TABLE "Chat" ADD COLUMN     "aiContextStartedAt" TIMESTAMP(3);

