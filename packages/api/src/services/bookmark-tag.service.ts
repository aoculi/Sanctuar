// Bookmark-Tag service - handles bookmark-tag relationship business logic
import * as bookmarkTagRepository from '../repositories/bookmark-tag.repository'
import * as bookmarkRepository from '../repositories/bookmark.repository'
import * as tagRepository from '../repositories/tag.repository'
import * as vaultRepository from '../repositories/vault.repository'

export interface CreateBookmarkTagLinkInput {
  item_id: string
  tag_id: string
  created_at: number
}

export interface CreateBookmarkTagLinkOutput {
  item_id: string
  tag_id: string
  linked: boolean
}

export interface DeleteBookmarkTagLinkInput {
  item_id: string
  tag_id: string
}

export interface DeleteBookmarkTagLinkOutput {
  item_id: string
  tag_id: string
  linked: boolean
}

export interface ListBookmarkTagsOutput {
  item_id: string
  tag_ids: string[]
}

/**
 * Link a tag to a bookmark (many-to-many relationship)
 * - Validates that both bookmark and tag exist and are not deleted
 * - Checks vault ownership for both entities
 * - Idempotent: duplicate link returns 200 OK
 * - Creates link in bookmark_tags table
 *
 * @param userId - The user ID from the authenticated token
 * @param input - Link data (item_id, tag_id, created_at)
 * @returns Link result with status
 */
export const createBookmarkTagLink = async (
  userId: string,
  input: CreateBookmarkTagLinkInput
): Promise<CreateBookmarkTagLinkOutput> => {
  try {
    // Find vault for user
    const vault = await vaultRepository.findVaultByUserId(userId)

    if (!vault) {
      const error = new Error('Vault not found')
      error.name = 'NotFoundError'
      throw error
    }

    // Validate that bookmark exists and is not deleted
    const bookmark = await bookmarkRepository.findBookmarkById(
      input.item_id,
      vault.vaultId
    )

    if (!bookmark) {
      const error = new Error('Bookmark not found')
      error.name = 'NotFoundError'
      throw error
    }

    if (bookmark.deletedAt !== null) {
      const error = new Error('Bookmark not found')
      error.name = 'NotFoundError'
      throw error
    }

    // Validate that tag exists and is not deleted
    const tag = await tagRepository.findTagById(input.tag_id, vault.vaultId)

    if (!tag) {
      const error = new Error('Tag not found')
      error.name = 'NotFoundError'
      throw error
    }

    if (tag.deletedAt !== null) {
      const error = new Error('Tag not found')
      error.name = 'NotFoundError'
      throw error
    }

    // Check if link already exists (idempotent operation)
    const linkExists = await bookmarkTagRepository.bookmarkTagLinkExists(
      vault.vaultId,
      input.item_id,
      input.tag_id
    )

    if (linkExists) {
      // Return 200 OK for existing link
      return {
        item_id: input.item_id,
        tag_id: input.tag_id,
        linked: true
      }
    }

    // Create new link
    await bookmarkTagRepository.createBookmarkTagLink({
      vaultId: vault.vaultId,
      itemId: input.item_id,
      tagId: input.tag_id,
      createdAt: input.created_at
    })

    console.log(
      `Bookmark-tag link created: item_id=${input.item_id}, tag_id=${input.tag_id}`
    )

    return {
      item_id: input.item_id,
      tag_id: input.tag_id,
      linked: true
    }
  } catch (error) {
    // Re-throw known errors
    if (error instanceof Error) {
      if (['NotFoundError', 'ValidationError'].includes(error.name)) {
        throw error
      }
    }

    // Log error without sensitive data
    console.error(
      'Create bookmark-tag link failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw new Error('Failed to create bookmark-tag link')
  }
}

/**
 * Unlink a tag from a bookmark (many-to-many relationship)
 * - Validates that both bookmark and tag exist and are not deleted
 * - Checks vault ownership for both entities
 * - Idempotent: if link doesn't exist, returns 200 OK with linked: false
 * - Removes link from bookmark_tags table
 *
 * @param userId - The user ID from the authenticated token
 * @param input - Unlink data (item_id, tag_id)
 * @returns Unlink result with status
 */
export const deleteBookmarkTagLink = async (
  userId: string,
  input: DeleteBookmarkTagLinkInput
): Promise<DeleteBookmarkTagLinkOutput> => {
  try {
    // Find vault for user
    const vault = await vaultRepository.findVaultByUserId(userId)

    if (!vault) {
      const error = new Error('Vault not found')
      error.name = 'NotFoundError'
      throw error
    }

    // Validate that bookmark exists and is not deleted
    const bookmark = await bookmarkRepository.findBookmarkById(
      input.item_id,
      vault.vaultId
    )

    if (!bookmark) {
      const error = new Error('Bookmark not found')
      error.name = 'NotFoundError'
      throw error
    }

    if (bookmark.deletedAt !== null) {
      const error = new Error('Bookmark not found')
      error.name = 'NotFoundError'
      throw error
    }

    // Validate that tag exists and is not deleted
    const tag = await tagRepository.findTagById(input.tag_id, vault.vaultId)

    if (!tag) {
      const error = new Error('Tag not found')
      error.name = 'NotFoundError'
      throw error
    }

    if (tag.deletedAt !== null) {
      const error = new Error('Tag not found')
      error.name = 'NotFoundError'
      throw error
    }

    // Check if link exists
    const linkExists = await bookmarkTagRepository.bookmarkTagLinkExists(
      vault.vaultId,
      input.item_id,
      input.tag_id
    )

    if (!linkExists) {
      // Idempotent: return 200 OK even if link doesn't exist
      return {
        item_id: input.item_id,
        tag_id: input.tag_id,
        linked: false
      }
    }

    // Delete the link
    await bookmarkTagRepository.deleteBookmarkTagLink(
      vault.vaultId,
      input.item_id,
      input.tag_id
    )

    console.log(
      `Bookmark-tag link deleted: item_id=${input.item_id}, tag_id=${input.tag_id}`
    )

    return {
      item_id: input.item_id,
      tag_id: input.tag_id,
      linked: false
    }
  } catch (error) {
    // Re-throw known errors
    if (error instanceof Error) {
      if (['NotFoundError', 'ValidationError'].includes(error.name)) {
        throw error
      }
    }

    // Log error without sensitive data
    console.error(
      'Delete bookmark-tag link failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw new Error('Failed to delete bookmark-tag link')
  }
}

/**
 * List tag IDs linked to a bookmark
 * - Validates vault and bookmark existence (and not deleted)
 * - Returns tag_ids excluding soft-deleted tags
 */
export const listTagsForBookmark = async (
  userId: string,
  itemId: string
): Promise<ListBookmarkTagsOutput> => {
  try {
    const vault = await vaultRepository.findVaultByUserId(userId)
    if (!vault) {
      const error = new Error('Vault not found')
      error.name = 'NotFoundError'
      throw error
    }

    const bookmark = await bookmarkRepository.findBookmarkById(
      itemId,
      vault.vaultId
    )
    if (!bookmark || bookmark.deletedAt !== null) {
      const error = new Error('Bookmark not found')
      error.name = 'NotFoundError'
      throw error
    }

    const tagIds = await bookmarkTagRepository.listTagIdsForItem(
      vault.vaultId,
      itemId
    )

    return { item_id: itemId, tag_ids: tagIds }
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      throw error
    }
    console.error(
      'List tags for bookmark failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw new Error('Failed to list tags for bookmark')
  }
}
