-- CreateTable
CREATE TABLE "AbandonedCart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "cartToken" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "customerName" TEXT,
    "cartData" TEXT NOT NULL,
    "totalPrice" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "recoveredAt" DATETIME,
    "isRecovered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CartNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cartId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CartNotification_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "AbandonedCart" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MerchantSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL DEFAULT 10,
    "discountExpiry" INTEGER NOT NULL DEFAULT 24,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappApiKey" TEXT,
    "emailFromName" TEXT,
    "emailFromAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AbandonedCart_cartToken_key" ON "AbandonedCart"("cartToken");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantSettings_shop_key" ON "MerchantSettings"("shop");
