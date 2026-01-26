ALTER TABLE `product_deliveries` ADD `rescheduleRequestedAt` timestamp;--> statement-breakpoint
ALTER TABLE `product_deliveries` ADD `rescheduleRequestedDate` timestamp;--> statement-breakpoint
ALTER TABLE `product_deliveries` ADD `rescheduleReason` text;--> statement-breakpoint
ALTER TABLE `product_deliveries` ADD `rescheduleStatus` enum('none','pending','approved','rejected') DEFAULT 'none';--> statement-breakpoint
ALTER TABLE `product_deliveries` ADD `rescheduleResponseAt` timestamp;--> statement-breakpoint
ALTER TABLE `product_deliveries` ADD `rescheduleResponseNote` text;