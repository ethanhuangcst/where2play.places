-- CreateTable
CREATE TABLE "SavedItinerary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "daysCount" INTEGER NOT NULL,
    "coverUrl" TEXT,
    "snapshot" JSONB NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedItinerary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItineraryChatMessage" (
    "id" TEXT NOT NULL,
    "itineraryId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "ord" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItineraryChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedItinerary_userId_savedAt_idx" ON "SavedItinerary"("userId", "savedAt");

-- CreateIndex
CREATE INDEX "ItineraryChatMessage_itineraryId_ord_idx" ON "ItineraryChatMessage"("itineraryId", "ord");

-- AddForeignKey
ALTER TABLE "SavedItinerary" ADD CONSTRAINT "SavedItinerary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryChatMessage" ADD CONSTRAINT "ItineraryChatMessage_itineraryId_fkey" FOREIGN KEY ("itineraryId") REFERENCES "SavedItinerary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
