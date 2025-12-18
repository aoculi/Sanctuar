// drizzle/schema.ts
import { relations, sql } from 'drizzle-orm'
import {
  blob,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'

// USERS
export const users = sqliteTable(
  'users',
  {
    userId: text('user_id').primaryKey(), // nanoid/uuid
    login: text('login').notNull(), // unique username/email

    // Argon2id PHC string for AUTH (includes its own salt & params)
    authHash: text('auth_hash').notNull(),

    // UEK KDF (client-side) parameters we persist for future derivations
    kdfAlgo: text('kdf_algo').notNull().default('argon2id'),
    kdfSalt: blob('kdf_salt', { mode: 'buffer' }).notNull(), // 16–32B raw binary
    kdfM: integer('kdf_m').notNull().default(524288), // 512 MB in KiB (512 * 1024)
    kdfT: integer('kdf_t').notNull().default(3),
    kdfP: integer('kdf_p').notNull().default(1),

    // HKDF salt for deriving KEK and MAK from Master Key
    hkdfSalt: blob('hkdf_salt', { mode: 'buffer' }), // 16B for HKDF

    // Wrapped Master Key (client-provided, AEAD under UEK)
    wmkNonce: blob('wmk_nonce', { mode: 'buffer' }), // 24B for XChaCha20-Poly1305
    wmkCiphertext: blob('wmk_ciphertext', { mode: 'buffer' }),
    wmkLabel: text('wmk_label').notNull().default('wmk_v1'),

    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
  },
  (table) => [
    uniqueIndex('users_login_unique').on(table.login),
    index('users_updated_at_idx').on(table.updatedAt)
  ]
)

// SESSIONS
export const sessions = sqliteTable(
  'sessions',
  {
    sessionId: text('session_id').primaryKey(), // nanoid/uuid
    userId: text('user_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),

    jwtId: text('jwt_id').notNull(), // jti
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
    revokedAt: integer('revoked_at') // nullable
  },
  (table) => [
    uniqueIndex('sessions_jwt_id_unique').on(table.jwtId),
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt)
  ]
)

export const vaults = sqliteTable('vaults', {
  vaultId: text('vault_id').primaryKey(),
  userId: text('user_id').notNull(),

  version: integer('version').notNull().default(0),
  bytesTotal: integer('bytes_total').notNull().default(0),

  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(strftime('%s','now') * 1000)`) // epoch ms
})

export const manifests = sqliteTable(
  'manifests',
  {
    vaultId: text('vault_id')
      .notNull()
      .references(() => vaults.vaultId, { onDelete: 'cascade' }),

    etag: text('etag').notNull(),
    version: integer('version').notNull(),

    nonce: blob('nonce').notNull(), // 24-byte AEAD nonce
    ciphertext: blob('ciphertext').notNull(),
    size: integer('size').notNull(),

    updatedAt: integer('updated_at')
      .notNull()
      .default(sql`(strftime('%s','now') * 1000)`)
  },
  (table) => [
    primaryKey({ columns: [table.vaultId] }),
    index('idx_manifests_etag').on(table.etag)
  ]
)

export const bookmarks = sqliteTable('bookmarks', {
  itemId: text('item_id').primaryKey(),
  vaultId: text('vault_id')
    .notNull()
    .references(() => vaults.vaultId, { onDelete: 'cascade' }),
  nonceContent: blob('nonce_content', { mode: 'buffer' }).notNull(),
  ciphertextContent: blob('ciphertext_content', { mode: 'buffer' }).notNull(),
  nonceWrap: blob('nonce_wrap', { mode: 'buffer' }).notNull(),
  dekWrapped: blob('dek_wrapped', { mode: 'buffer' }).notNull(),
  etag: text('etag').notNull(),
  version: integer('version').notNull().default(1),
  size: integer('size').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'number' })
})

// TAGS (Phase 2)
export const tags = sqliteTable(
  'tags',
  {
    tagId: text('tag_id').notNull(),
    vaultId: text('vault_id')
      .notNull()
      .references(() => vaults.vaultId, { onDelete: 'cascade' }),
    nonceContent: blob('nonce_content', { mode: 'buffer' }).notNull(),
    ciphertextContent: blob('ciphertext_content', { mode: 'buffer' }).notNull(),
    tagToken: text('tag_token'),
    etag: text('etag').notNull(),
    version: integer('version').notNull().default(1),
    size: integer('size').notNull(),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'number' })
  },
  (table) => [primaryKey({ columns: [table.tagId, table.vaultId] })]
)

// BOOKMARK_TAGS (junction)
export const bookmarkTags = sqliteTable(
  'bookmark_tags',
  {
    vaultId: text('vault_id')
      .notNull()
      .references(() => vaults.vaultId, { onDelete: 'cascade' }),
    itemId: text('item_id')
      .notNull()
      .references(() => bookmarks.itemId, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.tagId, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'number' }).notNull()
  },
  (table) => [
    primaryKey({ columns: [table.vaultId, table.itemId, table.tagId] })
  ]
)

// RELATIONS
export const vaultsRelations = relations(vaults, ({ many }) => ({
  manifests: many(manifests),
  bookmarks: many(bookmarks),
  tags: many(tags)
}))

export const manifestsRelations = relations(manifests, ({ one }) => ({
  vault: one(vaults, {
    fields: [manifests.vaultId],
    references: [vaults.vaultId]
  })
}))

export const bookmarksRelations = relations(bookmarks, ({ one, many }) => ({
  vault: one(vaults, {
    fields: [bookmarks.vaultId],
    references: [vaults.vaultId]
  }),
  bookmarkTags: many(bookmarkTags)
}))

export const tagsRelations = relations(tags, ({ one, many }) => ({
  vault: one(vaults, {
    fields: [tags.vaultId],
    references: [vaults.vaultId]
  }),
  bookmarkTags: many(bookmarkTags)
}))

export const bookmarkTagsRelations = relations(bookmarkTags, ({ one }) => ({
  vault: one(vaults, {
    fields: [bookmarkTags.vaultId],
    references: [vaults.vaultId]
  }),
  bookmark: one(bookmarks, {
    fields: [bookmarkTags.itemId],
    references: [bookmarks.itemId]
  }),
  tag: one(tags, {
    fields: [bookmarkTags.tagId],
    references: [tags.tagId]
  })
}))

// (Optional) convenient TS types
export type UserRow = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type SessionRow = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

export type VaultRow = typeof vaults.$inferSelect
export type NewVault = typeof vaults.$inferInsert

export type ManifestRow = typeof manifests.$inferSelect
export type NewManifest = typeof manifests.$inferInsert

export type BookmarkRow = typeof bookmarks.$inferSelect
export type NewBookmark = typeof bookmarks.$inferInsert

export type TagRow = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert

export type BookmarkTagRow = typeof bookmarkTags.$inferSelect
export type NewBookmarkTag = typeof bookmarkTags.$inferInsert
