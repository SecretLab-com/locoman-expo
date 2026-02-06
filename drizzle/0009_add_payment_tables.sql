CREATE TABLE `payment_sessions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `adyenSessionId` varchar(255) UNIQUE,
  `adyenSessionData` text,
  `merchantReference` varchar(128) NOT NULL UNIQUE,
  `requestedBy` int NOT NULL,
  `payerId` int,
  `amountMinor` int NOT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'GBP',
  `description` varchar(500),
  `method` enum('qr','link','tap','card','apple_pay'),
  `status` enum('created','pending','authorised','captured','refused','cancelled','error','refunded') NOT NULL DEFAULT 'created',
  `pspReference` varchar(128),
  `orderId` int,
  `subscriptionId` int,
  `paymentLink` text,
  `metadata` json,
  `expiresAt` timestamp NULL,
  `completedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `payment_logs` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `paymentSessionId` int,
  `pspReference` varchar(128),
  `merchantReference` varchar(128),
  `eventCode` varchar(64) NOT NULL,
  `success` boolean NOT NULL DEFAULT false,
  `amountMinor` int,
  `currency` varchar(3),
  `paymentMethod` varchar(64),
  `rawPayload` json,
  `reason` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
