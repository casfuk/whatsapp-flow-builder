-- AlterTable
ALTER TABLE "SessionState" ADD COLUMN     "assigneeId" TEXT;

-- CreateIndex
CREATE INDEX "SessionState_assigneeId_idx" ON "SessionState"("assigneeId");
