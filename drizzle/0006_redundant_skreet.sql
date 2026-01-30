CREATE TABLE `user_activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`targetUserId` int NOT NULL,
	`performedBy` int NOT NULL,
	`action` enum('role_changed','status_changed','impersonation_started','impersonation_ended','profile_updated','invited','deleted') NOT NULL,
	`previousValue` varchar(100),
	`newValue` varchar(100),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invitedBy` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(255),
	`role` enum('shopper','client','trainer','manager','coordinator') NOT NULL DEFAULT 'shopper',
	`token` varchar(64) NOT NULL,
	`status` enum('pending','accepted','expired','revoked') DEFAULT 'pending',
	`expiresAt` timestamp NOT NULL,
	`acceptedAt` timestamp,
	`acceptedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_invitations_token_unique` UNIQUE(`token`)
);
