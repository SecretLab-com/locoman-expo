ALTER TABLE `bundle_publications` ADD `syncedAt` timestamp;--> statement-breakpoint
ALTER TABLE `bundle_publications` ADD `syncStatus` enum('synced','pending','failed') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `bundle_publications` ADD `lastSyncError` text;