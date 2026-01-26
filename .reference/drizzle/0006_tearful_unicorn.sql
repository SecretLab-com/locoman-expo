CREATE TABLE `impersonation_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminUserId` int NOT NULL,
	`targetUserId` int,
	`targetRole` enum('shopper','client','trainer','manager','coordinator'),
	`action` enum('start','stop','switch') NOT NULL,
	`mode` enum('user','role') NOT NULL DEFAULT 'user',
	`ipAddress` varchar(45),
	`userAgent` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `impersonation_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `impersonation_shortcuts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminUserId` int NOT NULL,
	`targetUserId` int NOT NULL,
	`label` varchar(100),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `impersonation_shortcuts_id` PRIMARY KEY(`id`)
);
