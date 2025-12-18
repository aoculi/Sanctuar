// Bookmark-Tag repository - handles all database operations for bookmark-tag relationships
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../database/db'
import { bookmarkTags, NewBookmarkTag, tags } from '../database/schema'

/**
 * Check if a bookmark-tag link exists
 * @param vaultId - The vault ID
 * @param itemId - The bookmark item ID
 * @param tagId - The tag ID
 * @returns True if link exists, false otherwise
 */
export async function bookmarkTagLinkExists(
  vaultId: string,
  itemId: string,
  tagId: string
): Promise<boolean> {
  const result = await db
    .select({ vaultId: bookmarkTags.vaultId })
    .from(bookmarkTags)
    .where(
      and(
        eq(bookmarkTags.vaultId, vaultId),
        eq(bookmarkTags.itemId, itemId),
        eq(bookmarkTags.tagId, tagId)
      )
    )
    .limit(1)

  return result.length > 0
}

/**
 * Create a new bookmark-tag link
 * @param linkData - Bookmark-tag link data to insert
 * @returns The created bookmark-tag link record
 */
export async function createBookmarkTagLink(linkData: NewBookmarkTag) {
  await db.insert(bookmarkTags).values(linkData)

  // Fetch and return the created link
  const result = await db
    .select()
    .from(bookmarkTags)
    .where(
      and(
        eq(bookmarkTags.vaultId, linkData.vaultId),
        eq(bookmarkTags.itemId, linkData.itemId),
        eq(bookmarkTags.tagId, linkData.tagId)
      )
    )
    .limit(1)

  return result[0]
}

/**
 * Delete a bookmark-tag link
 * @param vaultId - The vault ID
 * @param itemId - The bookmark item ID
 * @param tagId - The tag ID
 */
export async function deleteBookmarkTagLink(
  vaultId: string,
  itemId: string,
  tagId: string
): Promise<void> {
  await db
    .delete(bookmarkTags)
    .where(
      and(
        eq(bookmarkTags.vaultId, vaultId),
        eq(bookmarkTags.itemId, itemId),
        eq(bookmarkTags.tagId, tagId)
      )
    )
}

/**
 * List tag IDs linked to a bookmark for a given vault, excluding soft-deleted tags
 */
export async function listTagIdsForItem(
  vaultId: string,
  itemId: string
): Promise<string[]> {
  const rows = await db
    .select({ tagId: bookmarkTags.tagId })
    .from(bookmarkTags)
    .innerJoin(
      tags,
      and(
        eq(tags.vaultId, bookmarkTags.vaultId),
        eq(tags.tagId, bookmarkTags.tagId)
      )
    )
    .where(
      and(
        eq(bookmarkTags.vaultId, vaultId),
        eq(bookmarkTags.itemId, itemId),
        isNull(tags.deletedAt)
      )
    )

  return rows.map((r) => r.tagId)
}
