-- CreateTable
CREATE TABLE "PlanSessionCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "criteriaJson" JSONB NOT NULL,
    "itineraryJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanSessionCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanSessionCache_userId_key" ON "PlanSessionCache"("userId");

-- CreateIndex
CREATE INDEX "PlanSessionCache_expiresAt_idx" ON "PlanSessionCache"("expiresAt");

-- AddForeignKey
ALTER TABLE "PlanSessionCache" ADD CONSTRAINT "PlanSessionCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
