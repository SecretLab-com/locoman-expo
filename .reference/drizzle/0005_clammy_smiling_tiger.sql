CREATE TABLE `join_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`userId` int NOT NULL,
	`message` text,
	`status` enum('pending','approved','rejected') DEFAULT 'pending',
	`reviewedAt` timestamp,
	`reviewNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `join_requests_id` PRIMARY KEY(`id`)
);
