-- Fold duplicate SavedItinerary rows per (userId, tripId) before unique.
-- Keep the newest savedAt; CASCADE removes orphaned ItineraryChatMessage rows.
DELETE FROM "SavedItinerary" AS s
WHERE s."tripId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "SavedItinerary" AS newer
    WHERE newer."userId" = s."userId"
      AND newer."tripId" = s."tripId"
      AND (
        newer."savedAt" > s."savedAt"
        OR (newer."savedAt" = s."savedAt" AND newer."id" > s."id")
      )
  );

-- Drop non-unique index if present (replaced by unique)
DROP INDEX IF EXISTS "SavedItinerary_userId_tripId_idx";

-- Unique allows multiple NULLs in PostgreSQL
CREATE UNIQUE INDEX "SavedItinerary_userId_tripId_key" ON "SavedItinerary"("userId", "tripId");
