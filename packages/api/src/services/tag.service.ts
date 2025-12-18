import { config } from '../config'
import { computeEtag } from '../libs/etag'
import * as tagRepository from '../repositories/tag.repository'
import * as vaultRepository from '../repositories/vault.repository'

type CreateTagInput = {
  tag_id: string
  nonce_content: string
  ciphertext_content: string
  size: number
  created_at: number
  updated_at: number
  tag_token?: string | null
}

type CreateTagOutput = {
  tag_id: string
  etag: string
  version: number
  updated_at: number
}

function isValidBase64(value: string): boolean {
  try {
    return (
      Buffer.from(value, 'base64').toString('base64') ===
      value.replace(/\n|\r/g, '')
    )
  } catch {
    return false
  }
}

function computeTagEtag(
  vaultId: string,
  version: number,
  nonceContent: Buffer,
  ciphertextContent: Buffer
): string {
  const allBytes = Buffer.concat([nonceContent, ciphertextContent])

  return computeEtag(vaultId, version, Buffer.alloc(0), allBytes)
}

type GetTagOutput = {
  tag_id: string
  version: number
  etag: string
  nonce_content: string
  ciphertext_content: string
  size: number
  created_at: number
  updated_at: number
  deleted_at: number | null
}

type UpdateTagInput = {
  version: number
  nonce_content: string
  ciphertext_content: string
  size: number
  updated_at: number
  tag_token?: string | null
}

type UpdateTagOutput = {
  tag_id: string
  etag: string
  version: number
  updated_at: number
}

type ListTagsOptions = {
  cursor?: string
  limit?: number
  includeDeleted?: boolean
  updatedAfter?: number
  byToken?: string
}

type TagListItem = {
  tag_id: string
  version: number
  etag: string
  nonce_content: string
  ciphertext_content: string
  size: number
  created_at: number
  updated_at: number
  deleted_at: number | null
}

type ListTagsOutput = {
  items: TagListItem[]
  next_cursor: string | null
}

export const getTag = async (
  userId: string,
  tagId: string
): Promise<GetTagOutput> => {
  try {
    // Find vault for user
    const vault = await vaultRepository.findVaultByUserId(userId)

    if (!vault) {
      const error = new Error('Vault not found')
      error.name = 'NotFoundError'
      throw error
    }

    // Fetch tag
    const tag = await tagRepository.findTagById(tagId, vault.vaultId)

    if (!tag) {
      const error = new Error('Tag not found')
      error.name = 'NotFoundError'
      throw error
    }

    // Convert buffers to base64 strings
    const nonceContent = tag.nonceContent as Buffer
    const ciphertextContent = tag.ciphertextContent as Buffer

    return {
      tag_id: tag.tagId,
      version: tag.version,
      etag: tag.etag,
      nonce_content: nonceContent.toString('base64'),
      ciphertext_content: ciphertextContent.toString('base64'),
      size: tag.size,
      created_at: tag.createdAt,
      updated_at: tag.updatedAt,
      deleted_at: tag.deletedAt
    }
  } catch (error) {
    // Re-throw known errors
    if (error instanceof Error && error.name === 'NotFoundError') {
      throw error
    }

    // Log error without sensitive data
    console.error(
      'Get tag failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw new Error('Failed to retrieve tag')
  }
}

export const updateTag = async (
  userId: string,
  tagId: string,
  input: UpdateTagInput,
  ifMatch?: string
): Promise<UpdateTagOutput> => {
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
      !isValidBase64(input.ciphertext_content)
    ) {
      const error = new Error('Invalid base64 encoding')
      error.name = 'ValidationError'
      throw error
    }

    // Decode base64 fields
    let nonceContent: Buffer
    let ciphertextContent: Buffer

    try {
      nonceContent = Buffer.from(input.nonce_content, 'base64')
      ciphertextContent = Buffer.from(input.ciphertext_content, 'base64')
    } catch (e) {
      const error = new Error('Invalid base64 encoding')
      error.name = 'ValidationError'
      throw error
    }

    // Calculate actual total size
    const actualSize = nonceContent.length + ciphertextContent.length

    // Validate size against provided size (optional check)
    if (input.size !== actualSize) {
      console.warn(
        `Size mismatch: provided=${input.size}, actual=${actualSize}`
      )
    }

    // Check size limit
    if (actualSize > config.items.maxSize) {
      const error = new Error(
        `Tag exceeds maximum size of ${config.items.maxSize} bytes`
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

    // Get current tag
    const currentTag = await tagRepository.findTagById(tagId, vault.vaultId)

    if (!currentTag) {
      const error = new Error('Tag not found')
      error.name = 'NotFoundError'
      throw error
    }

    // Validate version sequencing (must be current + 1)
    if (input.version !== currentTag.version + 1) {
      const error = new Error('Version conflict: version must be current + 1')
      error.name = 'ConflictError'
      throw error
    }

    // Validate ETag match
    if (ifMatch !== currentTag.etag) {
      const error = new Error('ETag mismatch')
      error.name = 'ConflictError'
      throw error
    }

    // Compute new ETag
    const newEtag = computeTagEtag(
      vault.vaultId,
      input.version,
      nonceContent,
      ciphertextContent
    )

    // Use timestamp from client
    const updatedAt = input.updated_at

    // Update tag record
    await tagRepository.updateTag(tagId, vault.vaultId, {
      nonceContent,
      ciphertextContent,
      etag: newEtag,
      version: input.version,
      size: actualSize,
      updatedAt,
      tagToken: input.tag_token
    })

    return {
      tag_id: tagId,
      etag: newEtag,
      version: input.version,
      updated_at: updatedAt
    }
  } catch (error) {
    // Re-throw known errors
    if (
      error instanceof Error &&
      (error.name === 'ValidationError' ||
        error.name === 'NotFoundError' ||
        error.name === 'ConflictError' ||
        error.name === 'PayloadTooLargeError')
    ) {
      throw error
    }

    // Log error without sensitive data
    console.error(
      'Update tag failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw new Error('Failed to update tag')
  }
}

export const listTags = async (
  userId: string,
  options: ListTagsOptions
): Promise<ListTagsOutput> => {
  try {
    const {
      cursor,
      limit = 100,
      includeDeleted = false,
      updatedAfter,
      byToken
    } = options

    // Validate and cap limit
    const effectiveLimit = Math.min(Math.max(1, limit), 500)

    // Find vault for user
    const vault = await vaultRepository.findVaultByUserId(userId)

    if (!vault) {
      // If no vault exists, return empty list
      return {
        items: [],
        next_cursor: null
      }
    }

    // Decode cursor (cursor is the last tag_id seen)
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

    // Fetch tags with pagination
    const tags = await tagRepository.listTagsPaginated(vault.vaultId, {
      limit: effectiveLimit,
      cursor: decodedCursor,
      includeDeleted,
      updatedAfter,
      byToken
    })

    // Check if there are more results
    const hasMore = tags.length > effectiveLimit
    const items = hasMore ? tags.slice(0, effectiveLimit) : tags

    // Convert to output format
    const outputItems: TagListItem[] = items.map((tag) => {
      const nonceContent = tag.nonceContent as Buffer
      const ciphertextContent = tag.ciphertextContent as Buffer

      return {
        tag_id: tag.tagId,
        version: tag.version,
        etag: tag.etag,
        nonce_content: nonceContent.toString('base64'),
        ciphertext_content: ciphertextContent.toString('base64'),
        size: tag.size,
        created_at: tag.createdAt,
        updated_at: tag.updatedAt,
        deleted_at: tag.deletedAt
      }
    })

    // Generate next cursor if there are more results
    let nextCursor: string | null = null
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1]
      nextCursor = Buffer.from(lastItem.tagId, 'utf-8').toString('base64url')
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
      'List tags failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw new Error('Failed to list tags')
  }
}

export const createTag = async (
  userId: string,
  input: CreateTagInput
): Promise<CreateTagOutput> => {
  try {
    if (
      !isValidBase64(input.nonce_content) ||
      !isValidBase64(input.ciphertext_content)
    ) {
      const error = new Error('Invalid base64 encoding')
      error.name = 'ValidationError'
      throw error
    }

    let nonceContent: Buffer
    let ciphertextContent: Buffer
    try {
      nonceContent = Buffer.from(input.nonce_content, 'base64')
      ciphertextContent = Buffer.from(input.ciphertext_content, 'base64')
    } catch {
      const error = new Error('Invalid base64 encoding')
      error.name = 'ValidationError'
      throw error
    }

    const actualSize = nonceContent.length + ciphertextContent.length
    if (input.size !== actualSize) {
      console.warn(
        `Size mismatch: provided=${input.size}, actual=${actualSize}`
      )
    }

    if (actualSize > config.items.maxSize) {
      const error = new Error(
        `Tag exceeds maximum size of ${config.items.maxSize} bytes`
      )
      error.name = 'PayloadTooLargeError'
      throw error
    }

    const vault = await vaultRepository.findVaultByUserId(userId)
    if (!vault) {
      const error = new Error('Vault not found. Please initialize vault first.')
      error.name = 'NotFoundError'
      throw error
    }

    const exists = await tagRepository.tagExists(input.tag_id, vault.vaultId)
    if (exists) {
      const error = new Error('Tag with this tag_id already exists')
      error.name = 'ConflictError'
      throw error
    }

    const version = 1
    const etag = computeTagEtag(
      vault.vaultId,
      version,
      nonceContent,
      ciphertextContent
    )

    const now = Date.now()
    const createdAt = input.created_at || now
    const updatedAt = input.updated_at || now

    await tagRepository.createTag({
      tagId: input.tag_id,
      vaultId: vault.vaultId,
      nonceContent,
      ciphertextContent,
      tagToken: input.tag_token ?? null,
      etag,
      version,
      size: actualSize,
      createdAt,
      updatedAt,
      deletedAt: null
    })

    return {
      tag_id: input.tag_id,
      etag,
      version,
      updated_at: updatedAt
    }
  } catch (error) {
    throw error
  }
}
