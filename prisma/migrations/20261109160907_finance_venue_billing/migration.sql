-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "locationId" INTEGER,
ADD COLUMN     "perSessionPrice" INTEGER;

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: a classroom with exactly one live branch puts its venues in that branch.
UPDATE "Venue" v SET "locationId" = l."id"
FROM "Location" l
WHERE l."classroomId" = v."classroomId" AND l."archivedAt" IS NULL AND v."locationId" IS NULL
  AND (SELECT COUNT(*) FROM "Location" l2 WHERE l2."classroomId" = v."classroomId" AND l2."archivedAt" IS NULL) = 1;
