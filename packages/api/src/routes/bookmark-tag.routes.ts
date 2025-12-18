// Bookmark-Tag routes - handles /bookmark-tags endpoints
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { createValidationErrorHandler } from '../libs/validation'
import { requireAuth } from '../middleware/auth.middleware'
import {
  createBookmarkTagLink,
  deleteBookmarkTagLink
} from '../services/bookmark-tag.service'

const bookmarkTagsRouter = new Hono()

export type AppType = typeof bookmarkTagsRouter

// Validation schema for POST /bookmark-tags
const createBookmarkTagLinkSchema = z.object({
  item_id: z.string().min(1, 'item_id is required'),
  tag_id: z.string().min(1, 'tag_id is required'),
  created_at: z.number().int().positive('created_at must be a positive integer')
})

// Validation schema for DELETE /bookmark-tags
const deleteBookmarkTagLinkSchema = z.object({
  item_id: z.string().min(1, 'item_id is required'),
  tag_id: z.string().min(1, 'tag_id is required')
})

/**
 * POST /bookmark-tags
 *
 * Link a tag to a bookmark (many-to-many relationship)
 * - Validates that both bookmark and tag exist and are not deleted
 * - Checks vault ownership for both entities
 * - Idempotent: duplicate link returns 200 OK
 * - Creates link in bookmark_tags table
 *
 * Auth: Authorization: Bearer <token>
 *
 * Request body:
 *   {
 *     "item_id": "bm_xxx",           // bookmark item ID
 *     "tag_id": "tag_xxx",           // tag ID
 *     "created_at": 1730004444000    // epoch ms timestamp
 *   }
 *
 * Response 201 Created (first link):
 *   {
 *     "item_id": "bm_xxx",
 *     "tag_id": "tag_xxx",
 *     "linked": true
 *   }
 *
 * Response 200 OK (already linked):
 *   {
 *     "item_id": "bm_xxx",
 *     "tag_id": "tag_xxx",
 *     "linked": true
 *   }
 *
 * Errors:
 *   - 400: Invalid request body (missing fields, invalid data)
 *   - 401: Unauthorized (missing or invalid token)
 *   - 404: Bookmark not found, Tag not found, or Vault not found
 *   - 500: Server error
 */
bookmarkTagsRouter.post(
  '/',
  requireAuth,
  zValidator(
    'json',
    createBookmarkTagLinkSchema,
    createValidationErrorHandler()
  ),
  async (c) => {
    try {
      // Get user ID from authenticated context (attached by middleware)
      const userId = (c.req.raw as any).userId as string

      // Get validated request body
      const body = c.req.valid('json')

      // Create bookmark-tag link
      const result = await createBookmarkTagLink(userId, body)

      // Return 201 Created (the service handles idempotency internally)
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

        // Log unexpected errors (no sensitive data)
        console.error('Create bookmark-tag link error:', error.message)
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
 * DELETE /bookmark-tags
 *
 * Unlink a tag from a bookmark (many-to-many relationship)
 * - Validates that both bookmark and tag exist and are not deleted
 * - Checks vault ownership for both entities
 * - Idempotent: if link doesn't exist, returns 200 OK with linked: false
 * - Removes link from bookmark_tags table
 *
 * Auth: Authorization: Bearer <token>
 *
 * Request body:
 *   {
 *     "item_id": "bm_xxx",           // bookmark item ID
 *     "tag_id": "tag_xxx"            // tag ID
 *   }
 *
 * Response 200 OK:
 *   {
 *     "item_id": "bm_xxx",
 *     "tag_id": "tag_xxx",
 *     "linked": false
 *   }
 *
 * Errors:
 *   - 400: Invalid request body (missing fields, invalid data)
 *   - 401: Unauthorized (missing or invalid token)
 *   - 404: Bookmark not found, Tag not found, or Vault not found
 *   - 500: Server error
 */
bookmarkTagsRouter.delete(
  '/',
  requireAuth,
  zValidator(
    'json',
    deleteBookmarkTagLinkSchema,
    createValidationErrorHandler()
  ),
  async (c) => {
    try {
      // Get user ID from authenticated context (attached by middleware)
      const userId = (c.req.raw as any).userId as string

      // Get validated request body
      const body = c.req.valid('json')

      // Delete bookmark-tag link
      const result = await deleteBookmarkTagLink(userId, body)

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

        // Log unexpected errors (no sensitive data)
        console.error('Delete bookmark-tag link error:', error.message)
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

export default bookmarkTagsRouter
