-- DropIndex
DROP INDEX "Round_status_deadlineAt_idx";

-- AlterTable
ALTER TABLE "Group" DROP COLUMN "roundDurationHours";

-- AlterTable
ALTER TABLE "Round" DROP COLUMN "deadlineAt";

