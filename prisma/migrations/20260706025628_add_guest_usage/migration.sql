-- CreateTable
CREATE TABLE "GuestUsage" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestUsage_ipHash_key" ON "GuestUsage"("ipHash");
