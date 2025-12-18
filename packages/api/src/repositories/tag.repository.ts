// Tag repository - handles DB operations for tags
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../database/db'
import { NewTag, tags } from '../database/schema'

/**
 * Check if a tag exists for a given vault
 */
export async function tagExists(
  tagId: string,
  vaultId: string
): Promise<boolean> {
  const result = await db
    .select({ tagId: tags.tagId })
    .from(tags)
    .where(and(eq(tags.tagId, tagId), eq(tags.vaultId, vaultId)))
    .limit(1)

  return result.length > 0
}

/**
 * Find a tag by tag ID and vault ID
 * @param tagId - The tag ID
 * @param vaultId - The vault ID
 * @returns Tag record or undefined if not found
 */
export async function findTagById(tagId: string, vaultId: string) {
  const result = await db
    .select()
    .from(tags)
    .where(and(eq(tags.tagId, tagId), eq(tags.vaultId, vaultId)))
    .limit(1)

  return result[0]
}

/**
 * Update an existing tag
 * @param tagId - The tag ID
 * @param vaultId - The vault ID
 * @param data - Data to update
 * @returns The updated tag record
 */
export async function updateTag(
  tagId: string,
  vaultId: string,
  data: {
    nonceContent?: Buffer
    ciphertextContent?: Buffer
    etag?: string
    version?: number
    size?: number
    updatedAt?: number
    tagToken?: string | null
  }
) {
  await db
    .update(tags)
    .set(data)
    .where(and(eq(tags.tagId, tagId), eq(tags.vaultId, vaultId)))

  return findTagById(tagId, vaultId)
}

/**
 * List tags for a vault (optionally include soft-deleted)
 * @param vaultId - The vault ID
 * @param includeDeleted - Whether to include soft-deleted tags
 * @returns Array of tag records
 */
export async function listTags(
  vaultId: string,
  includeDeleted: boolean = false
) {
  const conditions = includeDeleted
    ? [eq(tags.vaultId, vaultId)]
    : [eq(tags.vaultId, vaultId), isNull(tags.deletedAt)]

  return db
    .select()
    .from(tags)
    .where(and(...conditions))
    .orderBy(tags.createdAt)
}

/**
 * List tags with pagination and filtering
 * @param vaultId - The vault ID
 * @param options - Pagination and filter options
 * @returns Array of tag records
 */
export async function listTagsPaginated(
  vaultId: string,
  options: {
    limit: number
    cursor?: string
    includeDeleted?: boolean
    updatedAfter?: number
    byToken?: string
  }
) {
  const {
    limit,
    cursor,
    includeDeleted = false,
    updatedAfter,
    byToken
  } = options

  // Build conditions
  const conditions: any[] = [eq(tags.vaultId, vaultId)]

  // Include deleted filter
  if (!includeDeleted) {
    conditions.push(isNull(tags.deletedAt))
  }

  // Updated after filter (for incremental sync)
  if (updatedAfter !== undefined) {
    conditions.push(sql`${tags.updatedAt} > ${updatedAfter}`)
  }

  // By token filter (if implementing blind index)
  if (byToken !== undefined) {
    if (byToken === '') {
      // Empty string means null token_token
      conditions.push(sql`${tags.tagToken} IS NULL`)
    } else {
      conditions.push(eq(tags.tagToken, byToken))
    }
  }

  // Cursor filter (tag_id > cursor for pagination)
  if (cursor) {
    conditions.push(sql`${tags.tagId} > ${cursor}`)
  }

  return db
    .select()
    .from(tags)
    .where(and(...conditions))
    .orderBy(tags.tagId)
    .limit(limit + 1) // Fetch one extra to determine if there's a next page
}

/**
 * Create a new tag
 */
export async function createTag(tagData: NewTag) {
  await db.insert(tags).values(tagData)

  // Return created row
  const result = await db
    .select()
    .from(tags)
    .where(eq(tags.tagId, tagData.tagId))
    .limit(1)
  return result[0]
}
