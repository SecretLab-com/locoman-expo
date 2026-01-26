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
	`shopId` int,
	`trainerId` int NOT NULL,
	`templateId` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`imageUrl` text,
	`price` decimal(10,2),
	`cadence` enum('one_time','weekly','monthly') DEFAULT 'one_time',
	`selectionsJson` json,
	`servicesJson` json,
	`productsJson` json,
	`eligibilityRules` json,
	`scarcityRules` json,
	`status` enum('draft','validating','ready','publishing','published','failed') NOT NULL DEFAULT 'draft',
	`version` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bundle_drafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bundle_publications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`draftId` int NOT NULL,
	`shopifyProductId` varchar(64),
	`shopifyVariantId` varchar(64),
	`shopifyOperationId` varchar(64),
	`state` enum('init','product_created','bundle_creating','bundle_ready','publishing','published','failed') NOT NULL DEFAULT 'init',
	`lastError` text,
	`retryCount` int DEFAULT 0,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bundle_publications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bundle_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bundleDraftId` int NOT NULL,
	`reviewerId` int,
	`status` enum('pending','approved','rejected','changes_requested') DEFAULT 'pending',
	`reviewNotes` text,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bundle_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bundle_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shopId` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`goalType` enum('weight_loss','strength','longevity','power'),
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
CREATE TABLE `calendar_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`googleEmail` varchar(320),
	`accessToken` text,
	`refreshToken` text,
	`tokenExpiresAt` timestamp,
	`calendarId` varchar(255),
	`syncEnabled` boolean DEFAULT true,
	`lastSyncAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calendar_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calendar_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`googleEventId` varchar(255),
	`title` varchar(255) NOT NULL,
	`description` text,
	`location` varchar(255),
	`startTime` timestamp NOT NULL,
	`endTime` timestamp NOT NULL,
	`eventType` enum('session','delivery','appointment','other') DEFAULT 'other',
	`relatedClientId` int,
	`relatedOrderId` int,
	`reminderSent` boolean DEFAULT false,
	`syncedAt` timestamp,
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
	`shopDomain` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
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
	`shopifyLineItemId` bigint,
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
	`bundlePublicationId` int,
	`subscriptionId` int,
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
	`proofOfDelivery` text,
	`shopDomain` varchar(255),
	`orderData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `predictive_prompts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`trainerId` int,
	`triggerType` enum('pre_workout','post_workout','recovery','location','schedule','reorder') NOT NULL,
	`triggerEventId` int,
	`productId` int,
	`bundlePublicationId` int,
	`promptMessage` text NOT NULL,
	`suggestedProducts` json,
	`status` enum('pending','shown','accepted','dismissed','expired') DEFAULT 'pending',
	`scheduledFor` timestamp,
	`shownAt` timestamp,
	`respondedAt` timestamp,
	`resultingOrderId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `predictive_prompts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shopifyProductId` bigint,
	`shopifyVariantId` bigint,
	`shopDomain` varchar(255),
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
CREATE TABLE `recommendations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`targetType` enum('client','trainer','bundle') NOT NULL,
	`targetId` int NOT NULL,
	`recommendationType` enum('product','bundle_composition','pricing','client_match') NOT NULL,
	`recommendedItems` json NOT NULL,
	`confidence` decimal(5,4),
	`reasoning` text,
	`status` enum('active','applied','dismissed','expired') DEFAULT 'active',
	`appliedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `recommendations_id` PRIMARY KEY(`id`)
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
	`googleEventId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shopifyDomain` varchar(255) NOT NULL,
	`shopifyShopId` varchar(64),
	`accessToken` text,
	`scopes` text,
	`status` enum('active','suspended','uninstalled') DEFAULT 'active',
	`settings` json,
	`installedAt` timestamp DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shops_id` PRIMARY KEY(`id`),
	CONSTRAINT `shops_shopifyDomain_unique` UNIQUE(`shopifyDomain`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`trainerId` int NOT NULL,
	`bundleDraftId` int,
	`bundlePublicationId` int,
	`shopifySubscriptionId` varchar(64),
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
CREATE TABLE `trainer_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`managerId` int,
	`status` enum('pending','approved','rejected','suspended') DEFAULT 'pending',
	`applicationData` json,
	`reviewNotes` text,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trainer_approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('shopper','client','trainer','manager','coordinator') NOT NULL DEFAULT 'shopper';--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `photoUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `shopDomain` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `trainerId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `metadata` json;