-- DropIndex
DROP INDEX "Round_status_idx";

-- CreateIndex
CREATE INDEX "Round_status_deadlineAt_idx" ON "Round"("status", "deadlineAt");
