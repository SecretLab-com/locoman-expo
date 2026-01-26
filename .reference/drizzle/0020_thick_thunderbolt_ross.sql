CREATE TABLE `tag_colors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tag` varchar(100) NOT NULL,
	`color` varchar(7) NOT NULL,
	`category` enum('goal','service') NOT NULL,
	`label` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tag_colors_id` PRIMARY KEY(`id`)
);
