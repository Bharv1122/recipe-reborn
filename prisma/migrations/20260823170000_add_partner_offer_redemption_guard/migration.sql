ALTER TABLE "User"
  ADD COLUMN "partnerOfferRedeemedCode" TEXT,
  ADD COLUMN "partnerOfferRedeemedAt" TIMESTAMP(3),
  ADD COLUMN "partnerOfferCheckoutSessionId" TEXT;

CREATE UNIQUE INDEX "User_partnerOfferCheckoutSessionId_key"
  ON "User"("partnerOfferCheckoutSessionId");
