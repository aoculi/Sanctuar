PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tags` (
	`tag_id` text NOT NULL,
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
	PRIMARY KEY(`tag_id`, `vault_id`),
	FOREIGN KEY (`vault_id`) REFERENCES `vaults`(`vault_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tags`("tag_id", "vault_id", "nonce_content", "ciphertext_content", "tag_token", "etag", "version", "size", "created_at", "updated_at", "deleted_at") SELECT "tag_id", "vault_id", "nonce_content", "ciphertext_content", "tag_token", "etag", "version", "size", "created_at", "updated_at", "deleted_at" FROM `tags`;--> statement-breakpoint
DROP TABLE `tags`;--> statement-breakpoint
ALTER TABLE `__new_tags` RENAME TO `tags`;--> statement-breakpoint
PRAGMA foreign_keys=ON;