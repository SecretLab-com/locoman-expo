CREATE TABLE `message_reactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`userId` int NOT NULL,
	`reaction` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `message_reactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `messages` ADD `attachmentName` varchar(255);--> statement-breakpoint
ALTER TABLE `messages` ADD `attachmentSize` int;--> statement-breakpoint
ALTER TABLE `messages` ADD `attachmentMimeType` varchar(100);