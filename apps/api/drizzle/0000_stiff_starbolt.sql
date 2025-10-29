CREATE TABLE `sessions` (
	`session_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`jwt_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_jwt_id_unique` ON `sessions` (`jwt_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`user_id` text PRIMARY KEY NOT NULL,
	`login` text NOT NULL,
	`auth_hash` text NOT NULL,
	`kdf_algo` text DEFAULT 'argon2id' NOT NULL,
	`kdf_salt` blob NOT NULL,
	`kdf_m` integer DEFAULT 536870912 NOT NULL,
	`kdf_t` integer DEFAULT 3 NOT NULL,
	`kdf_p` integer DEFAULT 1 NOT NULL,
	`wmk_nonce` blob,
	`wmk_ciphertext` blob,
	`wmk_label` text DEFAULT 'wmk_v1' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_login_unique` ON `users` (`login`);--> statement-breakpoint
CREATE INDEX `users_updated_at_idx` ON `users` (`updated_at`);