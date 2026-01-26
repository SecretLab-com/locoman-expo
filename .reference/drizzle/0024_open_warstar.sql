CREATE TABLE `order_line_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`category` enum('product','service','facility') NOT NULL,
	`itemName` varchar(255) NOT NULL,
	`itemDescription` text,
	`shopifyProductId` varchar(100),
	`shopifyVariantId` varchar(100),
	`quantity` int NOT NULL DEFAULT 1,
	`unitPrice` decimal(10,2) NOT NULL,
	`totalPrice` decimal(10,2) NOT NULL,
	`vatRate` decimal(5,2) DEFAULT '0',
	`vatAmount` decimal(10,2) DEFAULT '0',
	`trainerId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_line_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `point_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`transactionType` enum('bundle_sale','new_client_bonus','client_retention','ad_partnership_sale','ad_partnership_renewal','upsell_bonus','monthly_target','tier_bonus','referral_bonus','redemption','adjustment','expiration') NOT NULL,
	`points` int NOT NULL,
	`referenceType` varchar(50),
	`referenceId` int,
	`description` text,
	`balanceBefore` int,
	`balanceAfter` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `point_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainer_awards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`awardType` enum('tier_achieved','monthly_top_seller','client_milestone','revenue_milestone','perfect_delivery','five_star_reviews','ad_champion','retention_master') NOT NULL,
	`awardName` varchar(255) NOT NULL,
	`description` text,
	`badgeIcon` varchar(100),
	`pointsAwarded` int DEFAULT 0,
	`metadata` json,
	`earnedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trainer_awards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainer_points` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`totalPoints` int NOT NULL DEFAULT 0,
	`lifetimePoints` int NOT NULL DEFAULT 0,
	`currentTier` enum('bronze','silver','gold','platinum') DEFAULT 'bronze',
	`tierCalculatedAt` timestamp,
	`yearToDatePoints` int DEFAULT 0,
	`yearToDateRevenue` decimal(12,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trainer_points_id` PRIMARY KEY(`id`),
	CONSTRAINT `trainer_points_trainerId_unique` UNIQUE(`trainerId`)
);
