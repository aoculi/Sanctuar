// Bookmark routes - handles /bookmarks endpoints
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { createValidationErrorHandler } from '../libs/validation'
import { requireAuth } from '../middleware/auth.middleware'
import { listTagsForBookmark } from '../services/bookmark-tag.service'
import {
  createBookmark,
  deleteBookmark,
  getBookmark,
  listBookmarks,
  updateBookmark
} from '../services/bookmark.service'

const bookmarksRouter = new Hono()

export type AppType = typeof bookmarksRouter

// Validation schema for POST /bookmarks
const createBookmarkSchema = z.object({
  item_id: z.string().min(1, 'item_id is required'),
  nonce_content: z.string().min(1, 'nonce_content is required'),
  ciphertext_content: z.string().min(1, 'ciphertext_content is required'),
  nonce_wrap: z.string().min(1, 'nonce_wrap is required'),
  dek_wrapped: z.string().min(1, 'dek_wrapped is required'),
  size: z.number().int().nonnegative('size must be non-negative'),
  created_at: z
    .number()
    .int()
    .positive('created_at must be a positive integer'),
  updated_at: z.number().int().positive('updated_at must be a positive integer')
})

// Validation schema for PUT /bookmarks/:id
const updateBookmarkSchema = z.object({
  version: z.number().int().positive('version must be a positive integer'),
  nonce_content: z.string().min(1, 'nonce_content is required'),
  ciphertext_content: z.string().min(1, 'ciphertext_content is required'),
  nonce_wrap: z.string().min(1, 'nonce_wrap is required'),
  dek_wrapped: z.string().min(1, 'dek_wrapped is required'),
  size: z.number().int().nonnegative('size must be non-negative'),
  updated_at: z.number().int().positive('updated_at must be a positive integer')
})

// Validation schema for DELETE /bookmarks/:id
const deleteBookmarkSchema = z.object({
  version: z.number().int().positive('version must be a positive integer'),
  deleted_at: z.number().int().positive('deleted_at must be a positive integer')
})

// Validation schema for GET /bookmarks (query parameters)
const listBookmarksSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  includeDeleted: z.coerce.boolean().optional().default(false),
  updatedAfter: z.coerce.number().int().positive().optional()
})

/**
 * GET /bookmarks
 *
 * List bookmarks with cursor-based pagination
 * - Supports filtering by includeDeleted and updatedAfter
 * - Returns opaque cursor for pagination
 * - No server-side plaintext filtering (client decrypts and filters)
 *
 * Auth: Authorization: Bearer <token>
 *
 * Query parameters:
 *   - cursor: Opaque cursor for pagination (optional)
 *   - limit: Number of items to return (default 50, max 200)
 *   - includeDeleted: Include soft-deleted bookmarks (default false)
 *   - updatedAfter: Filter by updated_at > value (epoch ms) for incremental sync
 *
 * Response 200:
 *   {
 *     "items": [
 *       {
 *         "item_id": "bm_xxx",
 *         "version": 3,
 *         "etag": "AbC...",
 *         "nonce_content": "<base64>",
 *         "ciphertext_content": "<base64>",
 *         "nonce_wrap": "<base64>",
 *         "dek_wrapped": "<base64>",
 *         "size": 1234,
 *         "created_at": 1730000000000,
 *         "updated_at": 1730001234000,
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
bookmarksRouter.get(
  '/',
  requireAuth,
  zValidator('query', listBookmarksSchema, createValidationErrorHandler()),
  async (c) => {
    try {
      // Get user ID from authenticated context
      const userId = (c.req.raw as any).userId as string

      // Get validated query parameters
      const query = c.req.valid('query')

      // List bookmarks
      const result = await listBookmarks(userId, query)

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
        console.error('List bookmarks error:', error.message)
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
 * POST /bookmarks
 *
 * Create an encrypted bookmark record
 * - Validates base64 encoding for all encrypted fields
 * - Validates size limits (ITEM_MAX_SIZE = 64 KB)
 * - Checks for duplicate item_id
 * - Computes ETag from vault_id || version || all-persisted-bytes
 * - Persists with version = 1, deleted_at = null
 *
 * Auth: Authorization: Bearer <token>
 *
 * Request body:
 *   {
 *     "item_id": "bm_xxx",                // client-generated id (uuid/nanoid)
 *     "nonce_content": "<base64>",        // AEAD content nonce
 *     "ciphertext_content": "<base64>",   // AEAD content (url,title,tags,...)
 *     "nonce_wrap": "<base64>",           // AEAD nonce for DEK wrap
 *     "dek_wrapped": "<base64>",          // DEK wrapped under KEK
 *     "size": 1234,                       // total bytes (server validates)
 *     "created_at": 1730000000000,        // epoch ms (client clock)
 *     "updated_at": 1730000000000         // equals created_at on create
 *   }
 *
 * Response 201 Created:
 *   {
 *     "item_id": "bm_xxx",
 *     "etag": "AbC...",
 *     "version": 1,
 *     "updated_at": 1730000000000
 *   }
 *
 * Errors:
 *   - 400: Invalid request body (missing fields, invalid base64, size mismatch)
 *   - 401: Unauthorized (missing or invalid token)
 *   - 404: Vault not found (user needs to initialize vault first)
 *   - 409: Conflict (duplicate item_id)
 *   - 413: Payload too large (exceeds ITEM_MAX_SIZE)
 *   - 500: Server error
 */
bookmarksRouter.post(
  '/',
  requireAuth,
  zValidator('json', createBookmarkSchema, createValidationErrorHandler()),
  async (c) => {
    try {
      // Get user ID from authenticated context (attached by middleware)
      const userId = (c.req.raw as any).userId as string

      // Get validated request body
      const body = c.req.valid('json')

      // Create bookmark
      const result = await createBookmark(userId, body)

      // Return 201 Created
      return c.json(result, 201)
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
        console.error('Create bookmark error:', error.message)
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
 * GET /bookmarks/:id
 *
 * Fetch a single encrypted bookmark by ID
 * - Resolves user_id from Bearer token
 * - Fetches bookmark from user's vault
 * - Returns all encrypted fields and metadata
 *
 * Auth: Authorization: Bearer <token>
 *
 * Response 200:
 *   {
 *     "item_id": "bm_xxx",
 *     "vault_id": "vlt_...",
 *     "version": 3,
 *     "etag": "AbC...",
 *     "nonce_content": "<base64>",
 *     "ciphertext_content": "<base64>",
 *     "nonce_wrap": "<base64>",
 *     "dek_wrapped": "<base64>",
 *     "size": 1234,
 *     "created_at": 1730000000000,
 *     "updated_at": 1730001234000,
 *     "deleted_at": null
 *   }
 *
 * Errors:
 *   - 401: Unauthorized (missing or invalid token)
 *   - 404: Bookmark not found or vault not found
 *   - 500: Server error
 */
bookmarksRouter.get('/:id', requireAuth, async (c) => {
  try {
    // Get user ID from authenticated context
    const userId = (c.req.raw as any).userId as string

    // Get item_id from URL parameter
    const itemId = c.req.param('id')

    // Fetch bookmark
    const bookmark = await getBookmark(userId, itemId)

    // Return bookmark data
    return c.json(bookmark, 200)
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
      console.error('Get bookmark error:', error.message)
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
 * GET /bookmarks/:id/tags
 *
 * List tag IDs linked to a bookmark
 *
 * Auth: Authorization: Bearer <token>
 *
 * Response 200:
 *   {
 *     "item_id": "bm_xxx",
 *     "tag_ids": ["tag_xxx", "tag_yyy"]
 *   }
 *
 * Errors:
 *   - 401: Unauthorized
 *   - 404: Bookmark not found or vault not found
 */
bookmarksRouter.get('/:id/tags', requireAuth, async (c) => {
  try {
    const userId = (c.req.raw as any).userId as string
    const itemId = c.req.param('id')

    const result = await listTagsForBookmark(userId, itemId)
    return c.json(result, 200)
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      return c.json({ error: error.message }, 404)
    }
    console.error(
      'List tags for bookmark error:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * PUT /bookmarks/:id
 *
 * Update an existing bookmark with optimistic concurrency control
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
 *     "version": 4,                       // must equal current_version + 1
 *     "nonce_content": "<base64>",
 *     "ciphertext_content": "<base64>",
 *     "nonce_wrap": "<base64>",
 *     "dek_wrapped": "<base64>",
 *     "size": 2345,
 *     "updated_at": 1730002222000
 *   }
 *
 * Response 200 OK:
 *   {
 *     "item_id": "bm_xxx",
 *     "etag": "New...",
 *     "version": 4,
 *     "updated_at": 1730002222000
 *   }
 *
 * Errors:
 *   - 400: Invalid request body (missing fields, invalid base64, size mismatch)
 *   - 401: Unauthorized (missing or invalid token)
 *   - 404: Bookmark not found or vault not found
 *   - 409: Conflict (ETag mismatch or version sequencing error)
 *   - 413: Payload too large (exceeds ITEM_MAX_SIZE)
 *   - 500: Server error
 */
bookmarksRouter.put(
  '/:id',
  requireAuth,
  zValidator('json', updateBookmarkSchema, createValidationErrorHandler()),
  async (c) => {
    try {
      // Get user ID from authenticated context
      const userId = (c.req.raw as any).userId as string

      // Get item_id from URL parameter
      const itemId = c.req.param('id')

      // Get validated request body
      const body = c.req.valid('json')

      // Get If-Match header
      const ifMatch = c.req.header('If-Match')

      // Update bookmark
      const result = await updateBookmark(userId, itemId, body, ifMatch)

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
        console.error('Update bookmark error:', error.message)
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
 * DELETE /bookmarks/:id
 *
 * Soft delete a bookmark with optimistic concurrency control
 * - Validates version sequencing (must be current + 1)
 * - Requires If-Match header with current ETag
 * - Sets deleted_at timestamp (soft delete)
 * - Computes new ETag (version changes)
 *
 * Auth: Authorization: Bearer <token>
 * Headers:
 *   - If-Match: <current-etag> (required)
 *
 * Request body:
 *   {
 *     "version": 5,
 *     "deleted_at": 1730003333000
 *   }
 *
 * Response 200 OK:
 *   {
 *     "item_id": "bm_xxx",
 *     "version": 5,
 *     "etag": "Del...",
 *     "deleted_at": 1730003333000
 *   }
 *
 * Errors:
 *   - 401: Unauthorized (missing or invalid token)
 *   - 404: Bookmark not found (or already deleted)
 *   - 409: Conflict (ETag mismatch or version sequencing error)
 *   - 500: Server error
 */
bookmarksRouter.delete(
  '/:id',
  requireAuth,
  zValidator('json', deleteBookmarkSchema, createValidationErrorHandler()),
  async (c) => {
    try {
      // Get user ID from authenticated context
      const userId = (c.req.raw as any).userId as string

      // Get item_id from URL parameter
      const itemId = c.req.param('id')

      // Get validated request body
      const body = c.req.valid('json')

      // Get If-Match header
      const ifMatch = c.req.header('If-Match')

      // Delete bookmark (soft delete)
      const result = await deleteBookmark(userId, itemId, body, ifMatch)

      // Return 200 OK
      return c.json(result, 200)
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

        if (error.name === 'ConflictError') {
          return c.json(
            {
              error: error.message
            },
            409
          )
        }

        // Log unexpected errors (no sensitive data)
        console.error('Delete bookmark error:', error.message)
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

export default bookmarksRouter
