-- Split Membership.isFinance into isCustodian (holds the classroom's money)
-- and canSettle (may settle / edit finance). Everyone who was finance keeps both.
ALTER TABLE "Membership"
ADD COLUMN     "isCustodian" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canSettle" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Membership" SET "isCustodian" = true, "canSettle" = true WHERE "isFinance" = true;

ALTER TABLE "Membership" DROP COLUMN "isFinance";
