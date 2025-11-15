PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`user_id` text PRIMARY KEY NOT NULL,
	`login` text NOT NULL,
	`auth_hash` text NOT NULL,
	`kdf_algo` text DEFAULT 'argon2id' NOT NULL,
	`kdf_salt` blob NOT NULL,
	`kdf_m` integer DEFAULT 524288 NOT NULL,
	`kdf_t` integer DEFAULT 3 NOT NULL,
	`kdf_p` integer DEFAULT 1 NOT NULL,
	`hkdf_salt` blob,
	`wmk_nonce` blob,
	`wmk_ciphertext` blob,
	`wmk_label` text DEFAULT 'wmk_v1' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("user_id", "login", "auth_hash", "kdf_algo", "kdf_salt", "kdf_m", "kdf_t", "kdf_p", "hkdf_salt", "wmk_nonce", "wmk_ciphertext", "wmk_label", "created_at", "updated_at") SELECT "user_id", "login", "auth_hash", "kdf_algo", "kdf_salt", "kdf_m", "kdf_t", "kdf_p", "hkdf_salt", "wmk_nonce", "wmk_ciphertext", "wmk_label", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_login_unique` ON `users` (`login`);--> statement-breakpoint
CREATE INDEX `users_updated_at_idx` ON `users` (`updated_at`);