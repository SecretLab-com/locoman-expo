CREATE TABLE `revoked_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`userId` int,
	`revokedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `revoked_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `revoked_sessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
