-- AlterTable
ALTER TABLE "SavedItinerary" ADD COLUMN "tripId" TEXT;

-- CreateIndex
CREATE INDEX "SavedItinerary_userId_tripId_idx" ON "SavedItinerary"("userId", "tripId");
