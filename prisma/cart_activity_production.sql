-- Safe, additive-only migration for the Cart Activity feature.
-- Only CREATEs two new tables; nothing existing is touched, dropped, or altered.

CREATE TABLE `CartActivity` (
    `id` VARCHAR(191) NOT NULL,
    `shop` VARCHAR(191) NOT NULL,
    `cartToken` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `price` VARCHAR(191) NOT NULL DEFAULT '0',
    `imageUrl` TEXT NULL,
    `customerEmail` VARCHAR(191) NULL,
    `customerName` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `remindedAt` DATETIME(3) NULL,
    `sentVia` VARCHAR(191) NULL,
    `scheduledSendAt` DATETIME(3) NULL,
    `scheduledSubject` VARCHAR(191) NULL,
    `scheduledBody` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CartActivity_shop_cartToken_variantId_key`(`shop`, `cartToken`, `variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CartActivitySettings` (
    `id` VARCHAR(191) NOT NULL,
    `shop` VARCHAR(191) NOT NULL,
    `sendMode` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `delayMinutes` INTEGER NOT NULL DEFAULT 60,
    `subject` VARCHAR(191) NOT NULL DEFAULT 'Still thinking it over?',
    `body` LONGTEXT NOT NULL,
    `trackerInstalled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CartActivitySettings_shop_key`(`shop`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
