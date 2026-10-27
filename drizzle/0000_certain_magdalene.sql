CREATE TABLE `review_usage` (
	`bucket` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL
);
