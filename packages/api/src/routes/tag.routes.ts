import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { createValidationErrorHandler } from '../libs/validation'
import { requireAuth } from '../middleware/auth.middleware'
import { createTag, getTag, listTags, updateTag } from '../services/tag.service'

const tags = new Hono()

export type AppType = typeof tags

// Validation schema for POST /tags
const createTagSchema = z.object({
  tag_id: z.string().min(1, 'tag_id is required'),
  nonce_content: z.string().min(1, 'nonce_content is required'),
  ciphertext_content: z.string().min(1, 'ciphertext_content is required'),
  size: z.number().int().nonnegative('size must be non-negative'),
  created_at: z
    .number()
    .int()
    .positive('created_at must be a positive integer'),
  updated_at: z
    .number()
    .int()
    .positive('updated_at must be a positive integer'),
  tag_token: z.string().nullable().optional()
})

// Validation schema for PUT /tags/:id
const updateTagSchema = z.object({
  version: z.number().int().positive('version must be a positive integer'),
  nonce_content: z.string().min(1, 'nonce_content is required'),
  ciphertext_content: z.string().min(1, 'ciphertext_content is required'),
  size: z.number().int().nonnegative('size must be non-negative'),
  updated_at: z
    .number()
    .int()
    .positive('updated_at must be a positive integer'),
  tag_token: z.string().nullable().optional()
})

// Validation schema for GET /tags
const listTagsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  includeDeleted: z.coerce.boolean().optional(),
  updatedAfter: z.coerce.number().int().positive().optional(),
  byToken: z.string().optional()
})

/**
 * GET /tags
 *
 * List tags with cursor-based pagination
 * - Supports filtering by includeDeleted, updatedAfter, and byToken
 * - Returns opaque cursor for pagination
 * - No server-side plaintext filtering (client decrypts and filters)
 *
 * Auth: Authorization: Bearer <token>
 *
 * Query parameters:
 *   - cursor: Opaque cursor for pagination (optional)
 *   - limit: Number of items to return (default 100, max 500)
 *   - includeDeleted: Include soft-deleted tags (default false)
 *   - updatedAfter: Filter by updated_at > value (epoch ms) for incremental sync
 *   - byToken: Filter by tag_token (if implementing blind index)
 *
 * Response 200:
 *   {
 *     "items": [
 *       {
 *         "tag_id": "tag_xxx",
 *         "version": 2,
 *         "etag": "TAb...",
 *         "nonce_content": "<base64>",
 *         "ciphertext_content": "<base64>",
 *         "size": 256,
 *         "created_at": 1730000000000,
 *         "updated_at": 1730001111000,
 *         "deleted_at": null
 *       }
 *     ],
 *     "next_cursor": "opaque_or_null"
 *   }
 *
 * Errors:
 *   - 400: Invalid query parameters
 *   - 401: Unauthorized
 *   - 500: Server error
 */
tags.get(
  '/',
  requireAuth,
  zValidator('query', listTagsSchema, createValidationErrorHandler()),
  async (c) => {
    try {
      // Get user ID from authenticated context
      const userId = (c.req.raw as any).userId as string

      // Get validated query parameters
      const query = c.req.valid('query')

      // List tags
      const result = await listTags(userId, query)

      // Return paginated list
      return c.json(result, 200)
    } catch (error) {
      // Handle known errors
      if (error instanceof Error) {
        if (error.name === 'ValidationError') {
          return c.json(
            {
              error: error.message
            },
            400
          )
        }

        // Log unexpected errors (no sensitive data)
        console.error('List tags error:', error.message)
      }

      // Generic server error response
      return c.json(
        {
          error: 'Internal server error'
        },
        500
      )
    }
  }
)

/**
 * GET /tags/:id
 *
 * Fetch a single encrypted tag by ID
 * - Resolves user_id from Bearer token
 * - Fetches tag from user's vault
 * - Returns all encrypted fields and metadata
 *
 * Auth: Authorization: Bearer <token>
 *
 * Response 200:
 *   {
 *     "tag_id": "tag_xxx",
 *     "version": 2,
 *     "etag": "TAb...",
 *     "nonce_content": "<base64>",
 *     "ciphertext_content": "<base64>",
 *     "size": 256,
 *     "created_at": 1730000000000,
 *     "updated_at": 1730001111000,
 *     "deleted_at": null
 *   }
 *
 * Errors:
 *   - 401: Unauthorized (missing or invalid token)
 *   - 404: Tag not found or vault not found
 *   - 500: Server error
 */
tags.get('/:id', requireAuth, async (c) => {
  try {
    // Get user ID from authenticated context
    const userId = (c.req.raw as any).userId as string

    // Get tag_id from URL parameter
    const tagId = c.req.param('id')

    // Fetch tag
    const tag = await getTag(userId, tagId)

    // Return tag data
    return c.json(tag, 200)
  } catch (error) {
    // Handle known errors
    if (error instanceof Error) {
      if (error.name === 'NotFoundError') {
        return c.json(
          {
            error: error.message
          },
          404
        )
      }

      // Log unexpected errors (no sensitive data)
      console.error('Get tag error:', error.message)
    }

    // Generic server error response
    return c.json(
      {
        error: 'Internal server error'
      },
      500
    )
  }
})

/**
 * PUT /tags/:id
 *
 * Update an existing tag with optimistic concurrency control
 * - Validates version sequencing (must be current + 1)
 * - Requires If-Match header with current ETag
 * - Validates base64 encoding and size limits
 * - Computes new ETag
 *
 * Auth: Authorization: Bearer <token>
 * Headers:
 *   - If-Match: <current-etag> (required)
 *
 * Request body:
 *   {
 *     "version": 3,
 *     "nonce_content": "<base64>",
 *     "ciphertext_content": "<base64>",
 *     "size": 300,
 *     "updated_at": 1730002222000,
 *     "tag_token": null
 *   }
 *
 * Response 200 OK:
 *   {
 *     "tag_id": "tag_xxx",
 *     "etag": "New...",
 *     "version": 3,
 *     "updated_at": 1730002222000
 *   }
 *
 * Errors:
 *   - 400: Invalid request body (missing fields, invalid base64, size mismatch)
 *   - 401: Unauthorized (missing or invalid token)
 *   - 404: Tag not found or vault not found
 *   - 409: Conflict (ETag mismatch or version sequencing error)
 *   - 413: Payload too large (exceeds ITEM_MAX_SIZE)
 *   - 500: Server error
 */
tags.put(
  '/:id',
  requireAuth,
  zValidator('json', updateTagSchema, createValidationErrorHandler()),
  async (c) => {
    try {
      // Get user ID from authenticated context
      const userId = (c.req.raw as any).userId as string

      // Get tag_id from URL parameter
      const tagId = c.req.param('id')

      // Check if tag_id is empty
      if (!tagId || tagId.trim() === '') {
        return c.json(
          {
            error: 'Tag not found'
          },
          404
        )
      }

      // Get validated request body
      const body = c.req.valid('json')

      // Get If-Match header
      const ifMatch = c.req.header('If-Match')

      // Update tag
      const result = await updateTag(userId, tagId, body, ifMatch)

      // Return 200 OK
      return c.json(result, 200)
    } catch (error) {
      // Handle known errors
      if (error instanceof Error) {
        if (error.name === 'ValidationError') {
          return c.json(
            {
              error: error.message
            },
            400
          )
        }

        if (error.name === 'NotFoundError') {
          return c.json(
            {
              error: error.message
            },
            404
          )
        }

        if (error.name === 'ConflictError') {
          return c.json(
            {
              error: error.message
            },
            409
          )
        }

        if (error.name === 'PayloadTooLargeError') {
          return c.json(
            {
              error: error.message
            },
            413
          )
        }

        // Log unexpected errors (no sensitive data)
        console.error('Update tag error:', error.message)
      }

      // Generic server error response
      return c.json(
        {
          error: 'Internal server error'
        },
        500
      )
    }
  }
)

/**
 * POST /tags
 *
 * Create an encrypted tag
 * - Validates base64 encoding for encrypted fields
 * - Validates size limits (ITEM_MAX_SIZE)
 * - Checks for duplicate tag_id
 * - Computes ETag from vault_id || version || all-persisted-bytes
 * - Persists with version = 1, deleted_at = null
 *
 * Auth: Authorization: Bearer <token>
 */
tags.post(
  '/',
  requireAuth,
  zValidator('json', createTagSchema, createValidationErrorHandler()),
  async (c) => {
    try {
      const userId = (c.req.raw as any).userId as string
      const body = c.req.valid('json')

      const result = await createTag(userId, body)

      return c.json(result, 201)
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'ValidationError') {
          return c.json({ error: error.message }, 400)
        }
        if (error.name === 'NotFoundError') {
          return c.json({ error: error.message }, 404)
        }
        if (error.name === 'ConflictError') {
          return c.json({ error: error.message }, 409)
        }
        if (error.name === 'PayloadTooLargeError') {
          return c.json({ error: error.message }, 413)
        }
        console.error('Create tag error:', error.message)
      }

      return c.json({ error: 'Internal server error' }, 500)
    }
  }
)

export default tags
