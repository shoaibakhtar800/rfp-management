-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VendorRFPStatus" ADD VALUE 'AWARDED';
ALTER TYPE "VendorRFPStatus" ADD VALUE 'NOT_SELECTED';

-- AlterTable
ALTER TABLE "RFP" ADD COLUMN     "awardNotes" TEXT,
ADD COLUMN     "awardedAt" TIMESTAMP(3),
ADD COLUMN     "awardedVendorId" TEXT,
ADD COLUMN     "evaluationSummary" TEXT,
ADD COLUMN     "recommendation" JSONB;

-- CreateIndex
CREATE INDEX "RFP_awardedVendorId_idx" ON "RFP"("awardedVendorId");

-- AddForeignKey
ALTER TABLE "RFP" ADD CONSTRAINT "RFP_awardedVendorId_fkey" FOREIGN KEY ("awardedVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
