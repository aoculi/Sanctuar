// Bookmark service - handles bookmark business logic
import { config } from '../config'
import { computeEtag } from '../libs/etag'
import * as bookmarkRepository from '../repositories/bookmark.repository'
import * as vaultRepository from '../repositories/vault.repository'

export interface CreateBookmarkInput {
  item_id: string
  nonce_content: string
  ciphertext_content: string
  nonce_wrap: string
  dek_wrapped: string
  size: number
  created_at: number
  updated_at: number
}

export interface CreateBookmarkOutput {
  item_id: string
  etag: string
  version: number
  updated_at: number
}

export interface GetBookmarkOutput {
  item_id: string
  vault_id: string
  version: number
  etag: string
  nonce_content: string
  ciphertext_content: string
  nonce_wrap: string
  dek_wrapped: string
  size: number
  created_at: number
  updated_at: number
  deleted_at: number | null
}

export interface UpdateBookmarkInput {
  version: number
  nonce_content: string
  ciphertext_content: string
  nonce_wrap: string
  dek_wrapped: string
  size: number
  updated_at: number
}

export interface UpdateBookmarkOutput {
  item_id: string
  etag: string
  version: number
  updated_at: number
}

export interface DeleteBookmarkInput {
  version: number
  deleted_at: number
}

export interface DeleteBookmarkOutput {
  item_id: string
  version: number
  etag: string
  deleted_at: number
}

export interface ListBookmarksOptions {
  cursor?: string
  limit?: number
  includeDeleted?: boolean
  updatedAfter?: number
}

export interface BookmarkListItem {
  item_id: string
  version: number
  etag: string
  nonce_content: string
  ciphertext_content: string
  nonce_wrap: string
  dek_wrapped: string
  size: number
  created_at: number
  updated_at: number
  deleted_at: number | null
}

export interface ListBookmarksOutput {
  items: BookmarkListItem[]
  next_cursor: string | null
}

/**
 * Validate base64 encoding
 * @param value - String to validate
 * @returns True if valid base64
 */
function isValidBase64(value: string): boolean {
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
  if (!base64Regex.test(value)) {
    return false
  }

  try {
    const buffer = Buffer.from(value, 'base64')
    // Verify the decoded data can be re-encoded to the same string
    return buffer.toString('base64') === value
  } catch {
    return false
  }
}

/**
 * Compute ETag for a bookmark
 * Based on: vault_id || version || all-persisted-bytes
 * All-persisted-bytes includes: nonce_content, ciphertext_content, nonce_wrap, dek_wrapped
 */
function computeBookmarkEtag(
  vaultId: string,
  version: number,
  nonceContent: Buffer,
  ciphertextContent: Buffer,
  nonceWrap: Buffer,
  dekWrapped: Buffer
): string {
  // Concatenate all persisted bytes
  const allBytes = Buffer.concat([
    nonceContent,
    ciphertextContent,
    nonceWrap,
    dekWrapped
  ])

  // Use the existing computeEtag function which does: SHA-256(vault_id || version || data)
  return computeEtag(vaultId, version, Buffer.alloc(0), allBytes)
}

/**
 * Create a new encrypted bookmark
 * - Validates base64 encoding
 * - Validates size limits
 * - Checks for duplicate item_id
 * - Computes ETag
 * - Persists with version = 1
 * @param userId - The user ID from the authenticated token
 * @param input - Bookmark data
 * @returns Created bookmark metadata
 */
export const createBookmark = async (
  userId: string,
  input: CreateBookmarkInput
): Promise<CreateBookmarkOutput> => {
  try {
    // Validate base64 encoding for all encrypted fields
    if (
      !isValidBase64(input.nonce_content) ||
      !isValidBase64(input.ciphertext_content) ||
      !isValidBase64(input.nonce_wrap) ||
      !isValidBase64(input.dek_wrapped)
    ) {
      const error = new Error('Invalid base64 encoding')
      error.name = 'ValidationError'
      throw error
    }

    // Decode base64 fields
    let nonceContent: Buffer
    let ciphertextContent: Buffer
    let nonceWrap: Buffer
    let dekWrapped: Buffer

    try {
      nonceContent = Buffer.from(input.nonce_content, 'base64')
      ciphertextContent = Buffer.from(input.ciphertext_content, 'base64')
      nonceWrap = Buffer.from(input.nonce_wrap, 'base64')
      dekWrapped = Buffer.from(input.dek_wrapped, 'base64')
    } catch (e) {
      const error = new Error('Invalid base64 encoding')
      error.name = 'ValidationError'
      throw error
    }

    // Calculate actual total size (all encrypted fields)
    const actualSize =
      nonceContent.length +
      ciphertextContent.length +
      nonceWrap.length +
      dekWrapped.length

    // Validate size against provided size (optional check)
    if (input.size !== actualSize) {
      console.warn(
        `Size mismatch: provided=${input.size}, actual=${actualSize}`
      )
    }

    // Check size limit
    if (actualSize > config.items.maxSize) {
      const error = new Error(
        `Bookmark exceeds maximum size of ${config.items.maxSize} bytes`
      )
      error.name = 'PayloadTooLargeError'
      throw error
    }

    // Find or create vault for user
    let vault = await vaultRepository.findVaultByUserId(userId)

    if (!vault) {
      const error = new Error('Vault not found. Please initialize vault first.')
      error.name = 'NotFoundError'
      throw error
    }

    // Check if bookmark with this item_id already exists
    const exists = await bookmarkRepository.bookmarkExists(
      input.item_id,
      vault.vaultId
    )

    if (exists) {
      const error = new Error('Bookmark with this item_id already exists')
      error.name = 'ConflictError'
      throw error
    }

    // Set version to 1 for new bookmarks
    const version = 1

    // Compute ETag
    const etag = computeBookmarkEtag(
      vault.vaultId,
      version,
      nonceContent,
      ciphertextContent,
      nonceWrap,
      dekWrapped
    )

    // Use timestamps from client (but server could override if needed)
    const now = Date.now()
    const createdAt = input.created_at || now
    const updatedAt = input.updated_at || now

    // Create bookmark record
    await bookmarkRepository.createBookmark({
      itemId: input.item_id,
      vaultId: vault.vaultId,
      nonceContent,
      ciphertextContent,
      nonceWrap,
      dekWrapped,
      etag,
      version,
      size: actualSize,
      createdAt,
      updatedAt,
      deletedAt: null // Not deleted
    })

    console.log(
      `Bookmark created: item_id=${input.item_id}, vault_id=${vault.vaultId}`
    )

    return {
      item_id: input.item_id,
      etag,
      version,
      updated_at: updatedAt
    }
  } catch (error) {
    // Re-throw known errors
    if (error instanceof Error) {
      if (
        [
          'ValidationError',
          'ConflictError',
          'PayloadTooLargeError',
          'NotFoundError'
        ].includes(error.name)
      ) {
        throw error
      }
    }

    // Log error without sensitive data
    console.error(
      'Create bookmark failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw new Error('Failed to create bookmark')
  }
}

/**
 * Get a single encrypted bookmark by ID
 * - Fetches bookmark from user's vault
 * - Returns all encrypted fields and metadata
 * @param userId - The user ID from the authenticated token
 * @param itemId - The bookmark item_id to fetch
 * @returns Bookmark data
 */
export const getBookmark = async (
  userId: string,
  itemId: string
): Promise<GetBookmarkOutput> => {
  try {
    // Find vault for user
    const vault = await vaultRepository.findVaultByUserId(userId)

    if (!vault) {
      const error = new Error('Vault not found')
      error.name = 'NotFoundError'
      throw error
    }

    // Fetch bookmark
    const bookmark = await bookmarkRepository.findBookmarkById(
      itemId,
      vault.vaultId
    )

    if (!bookmark) {
      const error = new Error('Bookmark not found')
      error.name = 'NotFoundError'
      throw error
    }

    // Convert buffers to base64 strings
    const nonceContent = bookmark.nonceContent as Buffer
    const ciphertextContent = bookmark.ciphertextContent as Buffer
    const nonceWrap = bookmark.nonceWrap as Buffer
    const dekWrapped = bookmark.dekWrapped as Buffer

    return {
      item_id: bookmark.itemId,
      vault_id: bookmark.vaultId,
      version: bookmark.version,
      etag: bookmark.etag,
      nonce_content: nonceContent.toString('base64'),
      ciphertext_content: ciphertextContent.toString('base64'),
      nonce_wrap: nonceWrap.toString('base64'),
      dek_wrapped: dekWrapped.toString('base64'),
      size: bookmark.size,
      created_at: bookmark.createdAt,
      updated_at: bookmark.updatedAt,
      deleted_at: bookmark.deletedAt
    }
  } catch (error) {
    // Re-throw known errors
    if (error instanceof Error && error.name === 'NotFoundError') {
      throw error
    }

    // Log error without sensitive data
    console.error(
      'Get bookmark failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw new Error('Failed to retrieve bookmark')
  }
}

/**
 * Update an existing bookmark with optimistic concurrency control
 * - Validates version sequencing (must be current + 1)
 * - Requires ETag match via If-Match header
 * - Validates base64 encoding and size limits
 * - Computes new ETag
 * @param userId - The user ID from the authenticated token
 * @param itemId - The bookmark item_id to update
 * @param input - Updated bookmark data
 * @param ifMatch - If-Match header value (ETag for concurrency control)
 * @returns Updated bookmark metadata
 */
export const updateBookmark = async (
  userId: string,
  itemId: string,
  input: UpdateBookmarkInput,
  ifMatch?: string
): Promise<UpdateBookmarkOutput> => {
  try {
    // Validate If-Match header is present
    if (!ifMatch) {
      const error = new Error('If-Match header required for updates')
      error.name = 'ConflictError'
      throw error
    }

    // Validate base64 encoding for all encrypted fields
    if (
      !isValidBase64(input.nonce_content) ||
      !isValidBase64(input.ciphertext_content) ||
      !isValidBase64(input.nonce_wrap) ||
      !isValidBase64(input.dek_wrapped)
    ) {
      const error = new Error('Invalid base64 encoding')
      error.name = 'ValidationError'
      throw error
    }

    // Decode base64 fields
    let nonceContent: Buffer
    let ciphertextContent: Buffer
    let nonceWrap: Buffer
    let dekWrapped: Buffer

    try {
      nonceContent = Buffer.from(input.nonce_content, 'base64')
      ciphertextContent = Buffer.from(input.ciphertext_content, 'base64')
      nonceWrap = Buffer.from(input.nonce_wrap, 'base64')
      dekWrapped = Buffer.from(input.dek_wrapped, 'base64')
    } catch (e) {
      const error = new Error('Invalid base64 encoding')
      error.name = 'ValidationError'
      throw error
    }

    // Calculate actual total size
    const actualSize =
      nonceContent.length +
      ciphertextContent.length +
      nonceWrap.length +
      dekWrapped.length

    // Validate size against provided size (optional check)
    if (input.size !== actualSize) {
      console.warn(
        `Size mismatch: provided=${input.size}, actual=${actualSize}`
      )
    }

    // Check size limit
    if (actualSize > config.items.maxSize) {
      const error = new Error(
        `Bookmark exceeds maximum size of ${config.items.maxSize} bytes`
      )
      error.name = 'PayloadTooLargeError'
      throw error
    }

    // Find vault for user
    const vault = await vaultRepository.findVaultByUserId(userId)

    if (!vault) {
      const error = new Error('Vault not found')
      error.name = 'NotFoundError'
      throw error
    }

    // Get current bookmark
    const currentBookmark = await bookmarkRepository.findBookmarkById(
      itemId,
      vault.vaultId
    )

    if (!currentBookmark) {
      const error = new Error('Bookmark not found')
      error.name = 'NotFoundError'
      throw error
    }

    // Validate version sequencing (must be current + 1)
    if (input.version !== currentBookmark.version + 1) {
      const error = new Error('Version conflict: version must be current + 1')
      error.name = 'ConflictError'
      throw error
    }

    // Validate ETag match
    if (ifMatch !== currentBookmark.etag) {
      const error = new Error('ETag mismatch')
      error.name = 'ConflictError'
      throw error
    }

    // Compute new ETag
    const newEtag = computeBookmarkEtag(
      vault.vaultId,
      input.version,
      nonceContent,
      ciphertextContent,
      nonceWrap,
      dekWrapped
    )

    // Use timestamp from client
    const updatedAt = input.updated_at

    // Update bookmark record
    await bookmarkRepository.updateBookmark(itemId, vault.vaultId, {
      nonceContent,
      ciphertextContent,
      nonceWrap,
      dekWrapped,
      etag: newEtag,
      version: input.version,
      size: actualSize,
      updatedAt
    })

    console.log(`Bookmark updated: item_id=${itemId}, version=${input.version}`)

    return {
      item_id: itemId,
      etag: newEtag,
      version: input.version,
      updated_at: updatedAt
    }
  } catch (error) {
    // Re-throw known errors
    if (error instanceof Error) {
      if (
        [
          'ValidationError',
          'ConflictError',
          'PayloadTooLargeError',
          'NotFoundError'
        ].includes(error.name)
      ) {
        throw error
      }
    }

    // Log error without sensitive data
    console.error(
      'Update bookmark failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw new Error('Failed to update bookmark')
  }
}

/**
 * Soft delete a bookmark with optimistic concurrency control
 * - Validates version sequencing (must be current + 1)
 * - Requires ETag match via If-Match header
 * - Sets deleted_at timestamp
 * - Computes new ETag (version changes)
 * @param userId - The user ID from the authenticated token
 * @param itemId - The bookmark item_id to delete
 * @param input - Delete data (version, deleted_at)
 * @param ifMatch - If-Match header value (ETag for concurrency control)
 * @returns Deleted bookmark metadata
 */
export const deleteBookmark = async (
  userId: string,
  itemId: string,
  input: DeleteBookmarkInput,
  ifMatch?: string
): Promise<DeleteBookmarkOutput> => {
  try {
    // Validate If-Match header is present
    if (!ifMatch) {
      const error = new Error('If-Match header required for deletes')
      error.name = 'ConflictError'
      throw error
    }

    // Find vault for user
    const vault = await vaultRepository.findVaultByUserId(userId)

    if (!vault) {
      const error = new Error('Vault not found')
      error.name = 'NotFoundError'
      throw error
    }

    // Get current bookmark
    const currentBookmark = await bookmarkRepository.findBookmarkById(
      itemId,
      vault.vaultId
    )

    if (!currentBookmark) {
      const error = new Error('Bookmark not found')
      error.name = 'NotFoundError'
      throw error
    }

    // If already deleted, return 404
    if (currentBookmark.deletedAt !== null) {
      const error = new Error('Bookmark not found')
      error.name = 'NotFoundError'
      throw error
    }

    // Validate version sequencing (must be current + 1)
    if (input.version !== currentBookmark.version + 1) {
      const error = new Error('Version conflict: version must be current + 1')
      error.name = 'ConflictError'
      throw error
    }

    // Validate ETag match
    if (ifMatch !== currentBookmark.etag) {
      const error = new Error('ETag mismatch')
      error.name = 'ConflictError'
      throw error
    }

    // Compute new ETag (version changes, so ETag changes)
    // Use existing encrypted data but new version
    const nonceContent = currentBookmark.nonceContent as Buffer
    const ciphertextContent = currentBookmark.ciphertextContent as Buffer
    const nonceWrap = currentBookmark.nonceWrap as Buffer
    const dekWrapped = currentBookmark.dekWrapped as Buffer

    const newEtag = computeBookmarkEtag(
      vault.vaultId,
      input.version,
      nonceContent,
      ciphertextContent,
      nonceWrap,
      dekWrapped
    )

    // Soft delete the bookmark
    await bookmarkRepository.updateBookmark(itemId, vault.vaultId, {
      etag: newEtag,
      version: input.version,
      updatedAt: input.deleted_at
    })

    await bookmarkRepository.softDeleteBookmark(
      itemId,
      vault.vaultId,
      input.deleted_at
    )

    console.log(
      `Bookmark soft-deleted: item_id=${itemId}, version=${input.version}`
    )

    return {
      item_id: itemId,
      version: input.version,
      etag: newEtag,
      deleted_at: input.deleted_at
    }
  } catch (error) {
    // Re-throw known errors
    if (error instanceof Error) {
      if (['ConflictError', 'NotFoundError'].includes(error.name)) {
        throw error
      }
    }

    // Log error without sensitive data
    console.error(
      'Delete bookmark failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw new Error('Failed to delete bookmark')
  }
}

/**
 * List bookmarks with cursor-based pagination
 * - Supports includeDeleted flag
 * - Supports updatedAfter for incremental sync
 * - Returns opaque cursor for next page
 * @param userId - The user ID from the authenticated token
 * @param options - List options (cursor, limit, filters)
 * @returns Paginated bookmark list
 */
export const listBookmarks = async (
  userId: string,
  options: ListBookmarksOptions
): Promise<ListBookmarksOutput> => {
  try {
    const { cursor, limit = 50, includeDeleted = false, updatedAfter } = options

    // Validate and cap limit
    const effectiveLimit = Math.min(Math.max(1, limit), 200)

    // Find vault for user
    const vault = await vaultRepository.findVaultByUserId(userId)

    if (!vault) {
      // If no vault exists, return empty list
      return {
        items: [],
        next_cursor: null
      }
    }

    // Decode cursor (cursor is the last item_id seen)
    let decodedCursor: string | undefined
    if (cursor) {
      try {
        decodedCursor = Buffer.from(cursor, 'base64url').toString('utf-8')
      } catch (e) {
        const error = new Error('Invalid cursor')
        error.name = 'ValidationError'
        throw error
      }
    }

    // Fetch bookmarks with pagination
    const bookmarks = await bookmarkRepository.listBookmarksPaginated(
      vault.vaultId,
      {
        limit: effectiveLimit,
        cursor: decodedCursor,
        includeDeleted,
        updatedAfter
      }
    )

    // Check if there are more results
    const hasMore = bookmarks.length > effectiveLimit
    const items = hasMore ? bookmarks.slice(0, effectiveLimit) : bookmarks

    // Convert to output format
    const outputItems: BookmarkListItem[] = items.map((bookmark) => {
      const nonceContent = bookmark.nonceContent as Buffer
      const ciphertextContent = bookmark.ciphertextContent as Buffer
      const nonceWrap = bookmark.nonceWrap as Buffer
      const dekWrapped = bookmark.dekWrapped as Buffer

      return {
        item_id: bookmark.itemId,
        version: bookmark.version,
        etag: bookmark.etag,
        nonce_content: nonceContent.toString('base64'),
        ciphertext_content: ciphertextContent.toString('base64'),
        nonce_wrap: nonceWrap.toString('base64'),
        dek_wrapped: dekWrapped.toString('base64'),
        size: bookmark.size,
        created_at: bookmark.createdAt,
        updated_at: bookmark.updatedAt,
        deleted_at: bookmark.deletedAt
      }
    })

    // Generate next cursor (opaque, base64url encoded)
    let nextCursor: string | null = null
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1]
      nextCursor = Buffer.from(lastItem.itemId, 'utf-8').toString('base64url')
    }

    return {
      items: outputItems,
      next_cursor: nextCursor
    }
  } catch (error) {
    // Re-throw known errors
    if (error instanceof Error && error.name === 'ValidationError') {
      throw error
    }

    // Log error without sensitive data
    console.error(
      'List bookmarks failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw new Error('Failed to list bookmarks')
  }
}
