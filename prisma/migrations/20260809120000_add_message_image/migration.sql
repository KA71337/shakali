-- AlterTable
ALTER TABLE "Message"
ADD COLUMN "imageData" BYTEA,
ADD COLUMN "imageMime" TEXT,
ADD COLUMN "imageSize" INTEGER;
