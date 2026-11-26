-- Add the MIX gender alongside MALE and FEMALE
ALTER TABLE `contestant` MODIFY COLUMN `sex` ENUM('MALE', 'FEMALE', 'MIX') NULL;
