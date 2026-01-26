ALTER TABLE `bundle_drafts` ADD `viewCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `bundle_drafts` ADD `salesCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `bundle_drafts` ADD `totalRevenue` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `bundle_drafts` ADD `lastViewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `bundle_drafts` ADD `lastSoldAt` timestamp;