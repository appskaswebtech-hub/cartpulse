-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `shop` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `isOnline` BOOLEAN NOT NULL DEFAULT false,
    `scope` VARCHAR(191) NULL,
    `expires` DATETIME(3) NULL,
    `accessToken` VARCHAR(191) NOT NULL,
    `userId` BIGINT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `accountOwner` BOOLEAN NOT NULL DEFAULT false,
    `locale` VARCHAR(191) NULL,
    `collaborator` BOOLEAN NULL DEFAULT false,
    `emailVerified` BOOLEAN NULL DEFAULT false,
    `refreshToken` VARCHAR(191) NULL,
    `refreshTokenExpires` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AbandonedCart` (
    `id` VARCHAR(191) NOT NULL,
    `shop` VARCHAR(191) NOT NULL,
    `cartToken` VARCHAR(191) NOT NULL,
    `customerEmail` VARCHAR(191) NULL,
    `customerPhone` VARCHAR(191) NULL,
    `customerName` VARCHAR(191) NULL,
    `cartData` LONGTEXT NOT NULL,
    `totalPrice` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `recoveredAt` DATETIME(3) NULL,
    `isRecovered` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AbandonedCart_cartToken_key`(`cartToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CartNotification` (
    `id` VARCHAR(191) NOT NULL,
    `cartId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MerchantSettings` (
    `id` VARCHAR(191) NOT NULL,
    `shop` VARCHAR(191) NOT NULL,
    `discountPercent` INTEGER NOT NULL DEFAULT 10,
    `discountExpiry` INTEGER NOT NULL DEFAULT 24,
    `pushEnabled` BOOLEAN NOT NULL DEFAULT true,
    `whatsappEnabled` BOOLEAN NOT NULL DEFAULT false,
    `emailEnabled` BOOLEAN NOT NULL DEFAULT true,
    `whatsappApiKey` VARCHAR(191) NULL,
    `emailFromName` VARCHAR(191) NULL,
    `emailFromAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MerchantSettings_shop_key`(`shop`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PushSubscription` (
    `id` VARCHAR(191) NOT NULL,
    `shop` VARCHAR(191) NOT NULL,
    `endpoint` VARCHAR(500) NOT NULL,
    `p256dh` VARCHAR(191) NOT NULL,
    `auth` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PushSubscription_endpoint_key`(`endpoint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JobQueue` (
    `id` VARCHAR(191) NOT NULL,
    `jobName` VARCHAR(191) NOT NULL,
    `payload` LONGTEXT NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CartNotification` ADD CONSTRAINT `CartNotification_cartId_fkey` FOREIGN KEY (`cartId`) REFERENCES `AbandonedCart`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
