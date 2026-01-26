CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(50),
	`entityId` int,
	`details` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bundle_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`templateId` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`imageUrl` text,
	`imageSource` enum('ai','custom') DEFAULT 'ai',
	`price` decimal(10,2),
	`cadence` enum('one_time','weekly','monthly') DEFAULT 'one_time',
	`selectionsJson` json,
	`servicesJson` json,
	`productsJson` json,
	`goalsJson` json,
	`suggestedGoal` varchar(100),
	`status` enum('draft','validating','ready','pending_review','pending_update','publishing','published','failed','rejected') NOT NULL DEFAULT 'draft',
	`shopifyProductId` bigint,
	`shopifyVariantId` bigint,
	`viewCount` int DEFAULT 0,
	`salesCount` int DEFAULT 0,
	`totalRevenue` decimal(10,2) DEFAULT '0',
	`submittedForReviewAt` timestamp,
	`reviewedAt` timestamp,
	`reviewedBy` int,
	`rejectionReason` text,
	`version` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bundle_drafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bundle_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`goalType` enum('weight_loss','strength','longevity','power'),
	`goalsJson` json,
	`imageUrl` text,
	`basePrice` decimal(10,2),
	`minPrice` decimal(10,2),
	`maxPrice` decimal(10,2),
	`rulesJson` json,
	`defaultServices` json,
	`defaultProducts` json,
	`active` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bundle_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calendar_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`location` varchar(255),
	`startTime` timestamp NOT NULL,
	`endTime` timestamp NOT NULL,
	`eventType` enum('session','delivery','appointment','other') DEFAULT 'other',
	`relatedClientId` int,
	`relatedOrderId` int,
	`reminderSent` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calendar_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`userId` int,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(20),
	`photoUrl` text,
	`goals` json,
	`notes` text,
	`status` enum('pending','active','inactive','removed') DEFAULT 'pending',
	`invitedAt` timestamp,
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(255),
	`token` varchar(64) NOT NULL,
	`bundleDraftId` int,
	`status` enum('pending','accepted','expired','revoked') DEFAULT 'pending',
	`expiresAt` timestamp NOT NULL,
	`acceptedAt` timestamp,
	`acceptedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `invitations_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`senderId` int NOT NULL,
	`receiverId` int NOT NULL,
	`conversationId` varchar(64) NOT NULL,
	`content` text NOT NULL,
	`messageType` enum('text','image','file','system') DEFAULT 'text',
	`attachmentUrl` text,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int,
	`name` varchar(255) NOT NULL,
	`quantity` int NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`totalPrice` decimal(10,2) NOT NULL,
	`fulfillmentStatus` enum('unfulfilled','fulfilled','restocked') DEFAULT 'unfulfilled',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shopifyOrderId` bigint,
	`shopifyOrderNumber` varchar(64),
	`clientId` int,
	`trainerId` int,
	`customerEmail` varchar(320),
	`customerName` varchar(255),
	`totalAmount` decimal(10,2) NOT NULL,
	`subtotalAmount` decimal(10,2),
	`taxAmount` decimal(10,2),
	`shippingAmount` decimal(10,2),
	`status` enum('pending','confirmed','processing','shipped','delivered','cancelled','refunded') DEFAULT 'pending',
	`fulfillmentStatus` enum('unfulfilled','partial','fulfilled','restocked') DEFAULT 'unfulfilled',
	`paymentStatus` enum('pending','paid','refunded','partially_refunded') DEFAULT 'pending',
	`fulfillmentMethod` enum('home_ship','trainer_delivery','vending','cafeteria') DEFAULT 'home_ship',
	`deliveryDate` timestamp,
	`deliveredAt` timestamp,
	`trackingNumber` varchar(255),
	`orderData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int,
	`orderItemId` int,
	`trainerId` int NOT NULL,
	`clientId` int NOT NULL,
	`productId` int,
	`productName` varchar(255) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`status` enum('pending','ready','scheduled','out_for_delivery','delivered','confirmed','disputed','cancelled') DEFAULT 'pending',
	`scheduledDate` timestamp,
	`deliveredAt` timestamp,
	`confirmedAt` timestamp,
	`deliveryMethod` enum('in_person','locker','front_desk','shipped'),
	`trackingNumber` varchar(255),
	`notes` text,
	`clientNotes` text,
	`disputeReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shopifyProductId` bigint,
	`shopifyVariantId` bigint,
	`name` varchar(255) NOT NULL,
	`description` text,
	`imageUrl` text,
	`price` decimal(10,2) NOT NULL,
	`compareAtPrice` decimal(10,2),
	`brand` varchar(100),
	`category` enum('protein','pre_workout','post_workout','recovery','strength','wellness','hydration','vitamins'),
	`phase` enum('preworkout','postworkout','recovery'),
	`fulfillmentOptions` json,
	`inventoryQuantity` int DEFAULT 0,
	`availability` enum('available','out_of_stock','discontinued') DEFAULT 'available',
	`isApproved` boolean DEFAULT false,
	`syncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`trainerId` int NOT NULL,
	`subscriptionId` int,
	`sessionDate` timestamp NOT NULL,
	`durationMinutes` int DEFAULT 60,
	`sessionType` enum('training','check_in','call','plan_review') DEFAULT 'training',
	`location` varchar(255),
	`status` enum('scheduled','completed','cancelled','no_show') DEFAULT 'scheduled',
	`notes` text,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`trainerId` int NOT NULL,
	`bundleDraftId` int,
	`status` enum('active','paused','cancelled','expired') DEFAULT 'active',
	`subscriptionType` enum('weekly','monthly','yearly') DEFAULT 'monthly',
	`price` decimal(10,2) NOT NULL,
	`startDate` timestamp NOT NULL,
	`renewalDate` timestamp,
	`pausedAt` timestamp,
	`cancelledAt` timestamp,
	`sessionsIncluded` int DEFAULT 0,
	`sessionsUsed` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainer_earnings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`orderId` int,
	`bundleDraftId` int,
	`subscriptionId` int,
	`earningType` enum('bundle_sale','subscription','commission','bonus') DEFAULT 'bundle_sale',
	`amount` decimal(10,2) NOT NULL,
	`status` enum('pending','approved','paid','cancelled') DEFAULT 'pending',
	`paidAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trainer_earnings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('shopper','client','trainer','manager','coordinator') NOT NULL DEFAULT 'shopper';--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `photoUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `specialties` json;--> statement-breakpoint
ALTER TABLE `users` ADD `socialLinks` json;--> statement-breakpoint
ALTER TABLE `users` ADD `trainerId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `metadata` json;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);