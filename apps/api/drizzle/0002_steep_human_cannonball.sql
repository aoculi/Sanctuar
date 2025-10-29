CREATE TABLE `bookmark_tags` (
	`vault_id` text NOT NULL,
	`item_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`vault_id`, `item_id`, `tag_id`),
	FOREIGN KEY (`vault_id`) REFERENCES `vaults`(`vault_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `bookmarks`(`item_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`tag_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `bookmarks` (
	`item_id` text PRIMARY KEY NOT NULL,
	`vault_id` text NOT NULL,
	`nonce_content` blob NOT NULL,
	`ciphertext_content` blob NOT NULL,
	`nonce_wrap` blob NOT NULL,
	`dek_wrapped` blob NOT NULL,
	`etag` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`vault_id`) REFERENCES `vaults`(`vault_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`tag_id` text PRIMARY KEY NOT NULL,
	`vault_id` text NOT NULL,
	`nonce_content` blob NOT NULL,
	`ciphertext_content` blob NOT NULL,
	`tag_token` text,
	`etag` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`vault_id`) REFERENCES `vaults`(`vault_id`) ON UPDATE no action ON DELETE cascade
);
