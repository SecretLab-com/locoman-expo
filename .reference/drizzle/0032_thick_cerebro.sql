CREATE TABLE `shopify_sync_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`triggeredBy` int NOT NULL,
	`status` enum('success','partial','failed') DEFAULT 'success',
	`productsSynced` int DEFAULT 0,
	`productsErrors` int DEFAULT 0,
	`bundlesSynced` int DEFAULT 0,
	`bundlesErrors` int DEFAULT 0,
	`customersSynced` int DEFAULT 0,
	`customersErrors` int DEFAULT 0,
	`syncedItems` json,
	`errorItems` json,
	`durationMs` int,
	`csvFileUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shopify_sync_results_id` PRIMARY KEY(`id`)
);
