-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "RefreshToken_userId_isActive_idx" ON "RefreshToken"("userId", "isActive");
