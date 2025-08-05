-- CreateEnum
CREATE TYPE "ocr_status" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "ocr_latex" TEXT,
ADD COLUMN     "ocr_processed_at" TIMESTAMP(3),
ADD COLUMN     "ocr_status" "ocr_status" NOT NULL DEFAULT 'pending',
ADD COLUMN     "ocr_text" TEXT;
