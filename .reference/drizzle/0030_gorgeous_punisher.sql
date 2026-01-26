ALTER TABLE `product_deliveries` ADD `resolvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `product_deliveries` ADD `resolvedBy` int;--> statement-breakpoint
ALTER TABLE `product_deliveries` ADD `resolutionType` enum('refund','redeliver','partial_refund','closed');--> statement-breakpoint
ALTER TABLE `product_deliveries` ADD `resolutionNotes` text;