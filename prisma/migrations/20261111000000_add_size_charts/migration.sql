CREATE TABLE IF NOT EXISTS `SizeChart` (
    `id` VARCHAR(191) NOT NULL,
    `shop` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `unitSystem` VARCHAR(191) NOT NULL DEFAULT 'cm',
    `template` VARCHAR(191) NOT NULL DEFAULT 'custom',
    `columns` LONGTEXT NOT NULL,
    `rows` LONGTEXT NOT NULL,
    `description` TEXT NULL,
    `assignType` VARCHAR(191) NOT NULL DEFAULT 'all',
    `assignValue` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SizeChart_shop_idx`(`shop`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
