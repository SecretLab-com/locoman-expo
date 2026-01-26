ALTER TABLE `orders` ADD `trackingNumber` varchar(255);--> statement-breakpoint
ALTER TABLE `orders` ADD `trackingUrl` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `carrier` varchar(100);--> statement-breakpoint
ALTER TABLE `orders` ADD `estimatedDelivery` timestamp;