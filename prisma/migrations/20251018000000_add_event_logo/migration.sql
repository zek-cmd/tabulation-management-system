-- Add a per-event institution logo
ALTER TABLE `event` ADD COLUMN `logoUrl` VARCHAR(191) NULL;
