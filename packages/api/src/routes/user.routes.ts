// User routes - handles /user endpoints
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { createValidationErrorHandler } from '../libs/validation'
import { requireAuth } from '../middleware/auth.middleware'
import { uploadWrappedMasterKey } from '../services/user.service'

const user = new Hono()

export type AppType = typeof user

// Validation schema for wrapped master key upload
const wmkSchema = z.object({
  wrapped_mk: z
    .string()
    .min(1, 'Wrapped master key is required')
    .refine(
      (val) => {
        try {
          const buffer = Buffer.from(val, 'base64')
          // Minimum: 24 bytes nonce + 16 bytes auth tag
          return buffer.length >= 40
        } catch {
          return false
        }
      },
      { message: 'Invalid base64 or wrapped master key too short' }
    ),
  label: z.string().optional()
})

/**
 * POST /user/wmk
 *
 * Upload Wrapped Master Key (WMK)
 * - Client derives UEK from password + KDF params
 * - Client generates random Master Key (MK)
 * - Client encrypts MK with UEK → WMK (XChaCha20-Poly1305)
 * - Client uploads WMK to server
 *
 * Auth: Authorization: Bearer <token>
 *
 * Request body:
 *   {
 *     "wrapped_mk": "<base64>",  // nonce (24B) + ciphertext
 *     "label": "wmk_v1"           // optional version/label
 *   }
 *
 * Response 200:
 *   {
 *     "ok": true
 *   }
 *
 * Errors:
 *   - 400: Invalid payload
 *   - 401: Unauthorized
 *   - 500: Server error
 */
user.post(
  '/wmk',
  requireAuth,
  zValidator('json', wmkSchema, createValidationErrorHandler()),
  async (c) => {
    try {
      // Get user ID from authenticated context
      const userId = (c.req.raw as any).userId as string

      // Get validated request body
      const { wrapped_mk, label } = c.req.valid('json')

      // Upload wrapped master key
      await uploadWrappedMasterKey({
        userId,
        wrappedMk: wrapped_mk,
        label
      })

      // Return success
      return c.json({ ok: true }, 200)
    } catch (error) {
      // Handle known errors
      if (error instanceof Error) {
        if (error.message === 'Invalid wrapped master key format') {
          return c.json(
            {
              error: 'Invalid wrapped master key format'
            },
            400
          )
        }

        // Log unexpected errors (no sensitive data)
        console.error('WMK upload error:', error.message)
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

export default user
