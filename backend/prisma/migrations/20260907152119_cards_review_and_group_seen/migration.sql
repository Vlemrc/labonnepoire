-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('DRAFT', 'VERIFIED', 'REJECTED');

-- DropIndex
DROP INDEX "Card_theme_idx";

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "reportCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "status" "CardStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "GroupSeenCard" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupSeenCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardReport" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupSeenCard_groupId_idx" ON "GroupSeenCard"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupSeenCard_groupId_cardId_key" ON "GroupSeenCard"("groupId", "cardId");

-- CreateIndex
CREATE UNIQUE INDEX "CardReport_cardId_userId_key" ON "CardReport"("cardId", "userId");

-- CreateIndex
CREATE INDEX "Card_theme_status_idx" ON "Card"("theme", "status");

-- AddForeignKey
ALTER TABLE "GroupSeenCard" ADD CONSTRAINT "GroupSeenCard_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSeenCard" ADD CONSTRAINT "GroupSeenCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardReport" ADD CONSTRAINT "CardReport_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardReport" ADD CONSTRAINT "CardReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
