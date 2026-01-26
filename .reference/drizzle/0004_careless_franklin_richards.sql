ALTER TABLE `bundle_drafts` MODIFY COLUMN `status` enum('draft','validating','ready','pending_review','publishing','published','failed','rejected') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `bundle_drafts` ADD `submittedForReviewAt` timestamp;--> statement-breakpoint
ALTER TABLE `bundle_drafts` ADD `reviewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `bundle_drafts` ADD `reviewedBy` int;--> statement-breakpoint
ALTER TABLE `bundle_drafts` ADD `rejectionReason` text;