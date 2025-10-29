CREATE TABLE `manifests` (
	`vault_id` text PRIMARY KEY NOT NULL,
	`etag` text NOT NULL,
	`version` integer NOT NULL,
	`nonce` blob NOT NULL,
	`ciphertext` blob NOT NULL,
	`size` integer NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`vault_id`) REFERENCES `vaults`(`vault_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_manifests_etag` ON `manifests` (`etag`);--> statement-breakpoint
CREATE TABLE `vaults` (
	`vault_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`bytes_total` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
