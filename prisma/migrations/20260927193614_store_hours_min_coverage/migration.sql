-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "closeMinute" INTEGER NOT NULL DEFAULT 1320,
ADD COLUMN     "openMinute" INTEGER NOT NULL DEFAULT 480;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "minCoverage" INTEGER NOT NULL DEFAULT 2;
