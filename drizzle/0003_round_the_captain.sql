CREATE TABLE `bundle_invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`clientId` int,
	`email` varchar(320),
	`bundleDraftId` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`message` text,
	`customPrice` decimal(10,2),
	`status` enum('pending','viewed','accepted','declined','expired') DEFAULT 'pending',
	`expiresAt` timestamp NOT NULL,
	`viewedAt` timestamp,
	`respondedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bundle_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `bundle_invitations_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `bundle_publications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bundleDraftId` int NOT NULL,
	`trainerId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`coverImageUrl` text,
	`price` decimal(10,2) NOT NULL,
	`servicesJson` json,
	`productsJson` json,
	`goalsJson` json,
	`status` enum('active','paused','archived') DEFAULT 'active',
	`viewCount` int DEFAULT 0,
	`purchaseCount` int DEFAULT 0,
	`publishedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bundle_publications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bundle_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bundlePublicationId` int NOT NULL,
	`subscriptionId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`title` varchar(255),
	`content` text,
	`isVerifiedPurchase` boolean DEFAULT true,
	`helpfulCount` int DEFAULT 0,
	`status` enum('pending','approved','rejected') DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bundle_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `impersonation_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coordinatorId` int NOT NULL,
	`targetUserId` int NOT NULL,
	`action` enum('start','end') NOT NULL,
	`reason` text,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `impersonation_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `join_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`trainerId` int NOT NULL,
	`message` text,
	`goals` json,
	`status` enum('pending','approved','rejected') DEFAULT 'pending',
	`responseMessage` text,
	`respondedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `join_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `point_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`type` enum('earned','redeemed','expired','bonus','adjustment') NOT NULL,
	`points` int NOT NULL,
	`description` text,
	`referenceType` varchar(50),
	`referenceId` int,
	`balanceAfter` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `point_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainer_awards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`awardType` varchar(100) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`iconUrl` text,
	`earnedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`metadata` json,
	CONSTRAINT `trainer_awards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainer_media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`type` enum('profile','gallery','video','certificate') NOT NULL,
	`url` text NOT NULL,
	`thumbnailUrl` text,
	`title` varchar(255),
	`description` text,
	`sortOrder` int DEFAULT 0,
	`isPublic` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trainer_media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainer_points` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`totalPoints` int NOT NULL DEFAULT 0,
	`lifetimePoints` int NOT NULL DEFAULT 0,
	`tier` enum('bronze','silver','gold','platinum') DEFAULT 'bronze',
	`tierUpdatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trainer_points_id` PRIMARY KEY(`id`),
	CONSTRAINT `trainer_points_trainerId_unique` UNIQUE(`trainerId`)
);
