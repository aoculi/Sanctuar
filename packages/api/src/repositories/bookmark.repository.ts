// Bookmark repository - handles all database operations for bookmarks
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../database/db'
import { bookmarks, NewBookmark } from '../database/schema'

/**
 * Find a bookmark by item ID and vault ID
 * @param itemId - The bookmark item ID
 * @param vaultId - The vault ID
 * @returns Bookmark record or undefined if not found
 */
export async function findBookmarkById(itemId: string, vaultId: string) {
  const result = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.itemId, itemId), eq(bookmarks.vaultId, vaultId)))
    .limit(1)

  return result[0]
}

/**
 * Check if a bookmark exists (including soft-deleted)
 * @param itemId - The bookmark item ID
 * @param vaultId - The vault ID
 * @returns True if bookmark exists, false otherwise
 */
export async function bookmarkExists(
  itemId: string,
  vaultId: string
): Promise<boolean> {
  const result = await db
    .select({ itemId: bookmarks.itemId })
    .from(bookmarks)
    .where(and(eq(bookmarks.itemId, itemId), eq(bookmarks.vaultId, vaultId)))
    .limit(1)

  return result.length > 0
}

/**
 * Create a new bookmark
 * @param bookmarkData - Bookmark data to insert
 * @returns The created bookmark record
 */
export async function createBookmark(bookmarkData: NewBookmark) {
  await db.insert(bookmarks).values(bookmarkData)

  // Fetch and return the created bookmark
  return findBookmarkById(bookmarkData.itemId, bookmarkData.vaultId)
}

/**
 * Update an existing bookmark
 * @param itemId - The bookmark item ID
 * @param vaultId - The vault ID
 * @param data - Data to update
 * @returns The updated bookmark record
 */
export async function updateBookmark(
  itemId: string,
  vaultId: string,
  data: {
    nonceContent?: Buffer
    ciphertextContent?: Buffer
    nonceWrap?: Buffer
    dekWrapped?: Buffer
    etag?: string
    version?: number
    size?: number
    updatedAt?: number
  }
) {
  await db
    .update(bookmarks)
    .set(data)
    .where(and(eq(bookmarks.itemId, itemId), eq(bookmarks.vaultId, vaultId)))

  return findBookmarkById(itemId, vaultId)
}

/**
 * Soft delete a bookmark by setting deletedAt timestamp
 * @param itemId - The bookmark item ID
 * @param vaultId - The vault ID
 * @param deletedAt - Timestamp for soft delete
 * @returns The updated bookmark record
 */
export async function softDeleteBookmark(
  itemId: string,
  vaultId: string,
  deletedAt: number
) {
  await db
    .update(bookmarks)
    .set({ deletedAt })
    .where(and(eq(bookmarks.itemId, itemId), eq(bookmarks.vaultId, vaultId)))

  return findBookmarkById(itemId, vaultId)
}

/**
 * List bookmarks for a vault (optionally include soft-deleted)
 * @param vaultId - The vault ID
 * @param includeDeleted - Whether to include soft-deleted bookmarks
 * @returns Array of bookmark records
 */
export async function listBookmarks(
  vaultId: string,
  includeDeleted: boolean = false
) {
  const conditions = includeDeleted
    ? [eq(bookmarks.vaultId, vaultId)]
    : [eq(bookmarks.vaultId, vaultId), isNull(bookmarks.deletedAt)]

  return db
    .select()
    .from(bookmarks)
    .where(and(...conditions))
    .orderBy(bookmarks.createdAt)
}

/**
 * List bookmarks with pagination and filtering
 * @param vaultId - The vault ID
 * @param options - Pagination and filter options
 * @returns Array of bookmark records
 */
export async function listBookmarksPaginated(
  vaultId: string,
  options: {
    limit: number
    cursor?: string
    includeDeleted?: boolean
    updatedAfter?: number
  }
) {
  const { limit, cursor, includeDeleted = false, updatedAfter } = options

  // Build conditions
  const conditions: any[] = [eq(bookmarks.vaultId, vaultId)]

  // Include deleted filter
  if (!includeDeleted) {
    conditions.push(isNull(bookmarks.deletedAt))
  }

  // Updated after filter (for incremental sync)
  if (updatedAfter !== undefined) {
    conditions.push(sql`${bookmarks.updatedAt} > ${updatedAfter}`)
  }

  // Cursor filter (item_id > cursor for pagination)
  if (cursor) {
    conditions.push(sql`${bookmarks.itemId} > ${cursor}`)
  }

  return db
    .select()
    .from(bookmarks)
    .where(and(...conditions))
    .orderBy(bookmarks.itemId)
    .limit(limit + 1) // Fetch one extra to determine if there's a next page
}
