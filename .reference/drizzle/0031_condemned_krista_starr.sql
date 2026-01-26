CREATE TABLE `analytics_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`generatedBy` int NOT NULL,
	`reportType` enum('revenue','trainers','bundles','orders','full') DEFAULT 'full',
	`dateRangeStart` timestamp,
	`dateRangeEnd` timestamp,
	`dateRangeLabel` varchar(50),
	`fileName` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileSize` int,
	`totalRevenue` decimal(12,2),
	`orderCount` int,
	`trainerCount` int,
	`bundleCount` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analytics_reports_id` PRIMARY KEY(`id`)
);
