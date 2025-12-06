-- CreateEnum
CREATE TYPE "AIJobType" AS ENUM ('PARSE_RFP', 'PARSE_PROPOSAL', 'SCORE_PROPOSAL', 'COMPARE_PROPOSALS');

-- CreateEnum
CREATE TYPE "AIJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "AIJob" (
    "id" TEXT NOT NULL,
    "type" "AIJobType" NOT NULL,
    "status" "AIJobStatus" NOT NULL DEFAULT 'PENDING',
    "rfpId" TEXT,
    "proposalId" TEXT,
    "inputData" JSONB,
    "outputData" JSONB,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "stepDescription" TEXT,
    "inngestEventId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIJob_inngestEventId_key" ON "AIJob"("inngestEventId");

-- CreateIndex
CREATE INDEX "AIJob_type_idx" ON "AIJob"("type");

-- CreateIndex
CREATE INDEX "AIJob_status_idx" ON "AIJob"("status");

-- CreateIndex
CREATE INDEX "AIJob_rfpId_idx" ON "AIJob"("rfpId");

-- CreateIndex
CREATE INDEX "AIJob_proposalId_idx" ON "AIJob"("proposalId");

-- CreateIndex
CREATE INDEX "AIJob_inngestEventId_idx" ON "AIJob"("inngestEventId");
