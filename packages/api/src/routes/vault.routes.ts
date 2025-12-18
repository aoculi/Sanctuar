// Vault routes - handles /vault endpoints
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { createValidationErrorHandler } from '../libs/validation'
import { requireAuth } from '../middleware/auth.middleware'
import {
  getManifest,
  getVaultMetadata,
  upsertManifest
} from '../services/vault.service'

const vault = new Hono()

export type AppType = typeof vault

// Validation schema for PUT /vault/manifest
const manifestSchema = z.object({
  version: z.number().int().positive('Version must be a positive integer'),
  nonce: z.string().min(1, 'Nonce is required'),
  ciphertext: z.string().min(1, 'Ciphertext is required'),
  size: z.number().int().nonnegative().optional()
})

/**
 * GET /vault
 *
 * Return non-secret metadata about the caller's vault
 * - Resolves user_id from Bearer token
 * - Lazily creates vault if it doesn't exist
 * - Returns vault metadata (version, size, manifest status)
 *
 * Auth: Authorization: Bearer <token>
 *
 * Response 200:
 *   {
 *     "vault_id": "vlt_abc123",
 *     "version": 0,
 *     "bytes_total": 0,
 *     "has_manifest": false,
 *     "updated_at": 1730000000000
 *   }
 *
 * Errors:
 *   - 401: Missing, invalid, or expired token
 *   - 500: Server error
 */
vault.get('/', requireAuth, async (c) => {
  try {
    // Get user ID from authenticated context (attached by middleware)
    const userId = (c.req.raw as any).userId as string

    // Get vault metadata (will create vault if needed)
    const metadata = await getVaultMetadata(userId)

    // Return vault metadata
    return c.json(metadata, 200)
  } catch (error) {
    // Log unexpected errors (no sensitive data)
    if (error instanceof Error) {
      console.error('Get vault error:', error.message)
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
 * GET|HEAD /vault/manifest
 *
 * Fetch the encrypted manifest blob for the caller's vault (GET)
 * OR check current ETag and version without downloading blob (HEAD)
 * - Resolves user_id from Bearer token
 * - Derives vault_id from user_id
 * - For HEAD: Returns headers only (no body)
 * - For GET: Returns full encrypted manifest data
 *
 * Auth: Authorization: Bearer <token>
 *
 * Response 200 (GET):
 *   {
 *     "vault_id": "vlt_abc123",
 *     "version": 12,
 *     "etag": "L5z7w8...base64url",
 *     "nonce": "<base64>",
 *     "ciphertext": "<base64>",
 *     "size": 123456,
 *     "updated_at": 1730000000000
 *   }
 *
 * Response 200 (HEAD, headers only):
 *   etag: "L5z7w8...base64url"
 *   x-vault-version: "12"
 *
 * Errors:
 *   - 401: Missing, invalid, or expired token
 *   - 404: Manifest not found (not initialized yet)
 *   - 500: Server error
 */
vault.on(['GET', 'HEAD'], '/manifest', requireAuth, async (c) => {
  try {
    // Get user ID from authenticated context (attached by middleware)
    const userId = (c.req.raw as any).userId as string

    // Get manifest data
    const manifest = await getManifest(userId)

    // Handle HEAD request - return headers only
    if (c.req.method === 'HEAD') {
      c.header('etag', manifest.etag)
      c.header('x-vault-version', manifest.version.toString())
      return c.body(null)
    }

    // Handle GET request - return full manifest
    return c.json(manifest, 200)
  } catch (error) {
    // Handle known errors
    if (error instanceof Error) {
      if (error.name === 'NotFoundError') {
        return c.json(
          {
            error: 'Manifest not found'
          },
          404
        )
      }

      // Log unexpected errors (no sensitive data)
      console.error('Get/Head manifest error:', error.message)
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
 * PUT /vault/manifest
 *
 * Create or update encrypted manifest with optimistic concurrency control
 * - Resolves user_id from Bearer token
 * - Validates version sequencing (must be current + 1)
 * - Requires If-Match header for updates (version > 1)
 * - Computes ETag from vault_id || version || nonce || ciphertext
 *
 * Auth: Authorization: Bearer <token>
 * Headers:
 *   - If-Match: <etag> (required for version > 1)
 *
 * Request body:
 *   {
 *     "version": 13,
 *     "nonce": "<base64>",
 *     "ciphertext": "<base64>",
 *     "size": 123456 (optional)
 *   }
 *
 * Response 201 Created (first manifest):
 *   {
 *     "vault_id": "vlt_abc123",
 *     "version": 1,
 *     "etag": "Kf2...base64url",
 *     "updated_at": 1730000000000
 *   }
 *
 * Response 200 OK (updates):
 *   {
 *     "vault_id": "vlt_abc123",
 *     "version": 13,
 *     "etag": "JH8...base64url",
 *     "updated_at": 1730000000000
 *   }
 *
 * Errors:
 *   - 400: Invalid body (missing fields, non-base64)
 *   - 401: Unauthorized
 *   - 409: Conflict (ETag mismatch or version sequencing)
 *   - 413: Payload too large (exceeds 5MB)
 *   - 500: Server error
 */
vault.put(
  '/manifest',
  requireAuth,
  zValidator('json', manifestSchema, createValidationErrorHandler()),
  async (c) => {
    try {
      // Get user ID from authenticated context
      const userId = (c.req.raw as any).userId as string

      // Get validated request body
      const body = c.req.valid('json')

      // Get If-Match header
      const ifMatch = c.req.header('If-Match')

      // Upsert manifest
      const { output, isNew } = await upsertManifest(userId, body, ifMatch)

      // Return 201 for first manifest, 200 for updates
      return c.json(output, isNew ? 201 : 200)
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
        console.error('Put manifest error:', error.message)
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

export default vault
