CREATE TABLE `service_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`trainerId` int NOT NULL,
	`clientId` int NOT NULL,
	`bundleId` int,
	`bundleTitle` varchar(255),
	`serviceType` varchar(100) NOT NULL,
	`serviceName` varchar(255) NOT NULL,
	`totalQuantity` int NOT NULL,
	`deliveredQuantity` int NOT NULL DEFAULT 0,
	`pricePerUnit` decimal(10,2) NOT NULL,
	`status` enum('pending','in_progress','completed') DEFAULT 'pending',
	`notes` text,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainer_earnings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`orderId` int NOT NULL,
	`bundleId` int,
	`bundleTitle` varchar(255),
	`clientId` int,
	`clientName` varchar(255),
	`productCommission` decimal(10,2) NOT NULL DEFAULT '0',
	`serviceRevenue` decimal(10,2) NOT NULL DEFAULT '0',
	`totalEarnings` decimal(10,2) NOT NULL DEFAULT '0',
	`orderTotal` decimal(10,2),
	`status` enum('pending','confirmed','paid') DEFAULT 'pending',
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trainer_earnings_id` PRIMARY KEY(`id`)
);
