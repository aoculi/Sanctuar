// Authentication routes - handles /auth endpoints
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { config } from '../config'
import { ERROR_MESSAGES, ERROR_NAMES, logError } from '../libs/errors'
import { createValidationErrorHandler } from '../libs/validation'
import { requireAuth } from '../middleware/auth.middleware'
import {
  rateLimitAuth,
  rateLimitRefresh
} from '../middleware/rate-limit.middleware'
import * as sessionRepository from '../repositories/session.repository'
import {
  loginUser,
  logoutUser,
  refreshSession,
  registerUser
} from '../services/auth.service'

const auth = new Hono()

export type AppType = typeof auth

// Validation schema for registration and login
const authSchema = z.object({
  login: z
    .string()
    .min(
      config.validation.login.minLength,
      `Login must be at least ${config.validation.login.minLength} characters`
    )
    .max(
      config.validation.login.maxLength,
      `Login must not exceed ${config.validation.login.maxLength} characters`
    )
    .trim(),
  password: z
    .string()
    .min(
      config.validation.password.minLength,
      `Password must be at least ${config.validation.password.minLength} characters`
    )
    .max(
      config.validation.password.maxLength,
      `Password must not exceed ${config.validation.password.maxLength} characters`
    )
})

/**
 * POST /auth/register
 *
 * Register a new user credential on the API
 * - Server generates salts and derives password verifier
 * - Returns KDF info for client to derive UEK later
 * - Rate limited: 5 attempts per minute per IP/login
 *
 * Request body:
 *   - login: string (email or username; unique)
 *   - password: string (8-128 characters)
 *
 * Response 201:
 *   {
 *     "user_id": "u_xxxxx",
 *     "kdf": {
 *       "algo": "argon2id",
 *       "salt": "<base64>",
 *       "m": 536870912,
 *       "t": 3,
 *       "p": 1
 *     }
 *   }
 *
 * Errors:
 *   - 400: Invalid input
 *   - 409: Login already exists
 *   - 429: Too many requests (rate limited)
 *   - 500: Server error
 */
auth.post(
  '/register',
  rateLimitAuth,
  zValidator('json', authSchema, createValidationErrorHandler()),
  async (c) => {
    try {
      const { login, password } = c.req.valid('json')

      // Register user through auth service
      const result = await registerUser({ login, password })

      // Return success with user_id and KDF parameters
      return c.json(result, 201)
    } catch (error) {
      // Handle known errors
      if (error instanceof Error && error.name === ERROR_NAMES.CONFLICT) {
        return c.json({ error: ERROR_MESSAGES.LOGIN_EXISTS }, 409)
      }

      logError('Registration error', error)
      return c.json({ error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR }, 500)
    }
  }
)

/**
 * POST /auth/login
 *
 * Verify password and issue short-lived session
 * - Verifies credentials against stored hash
 * - Creates session and generates JWT token
 * - Returns KDF info and wrapped master key (if exists)
 * - Rate limited: 5 attempts per minute per IP/login
 *
 * Request body:
 *   - login: string (email or username)
 *   - password: string
 *
 * Response 200:
 *   {
 *     "user_id": "u_xxxxx",
 *     "token": "<JWT>",
 *     "expires_at": 1730000000000,
 *     "kdf": {
 *       "algo": "argon2id",
 *       "salt": "<base64>",
 *       "m": 536870912,
 *       "t": 3,
 *       "p": 1
 *     },
 *     "wrapped_mk": "<base64>|null"
 *   }
 *
 * Errors:
 *   - 400: Invalid input
 *   - 401: Invalid credentials
 *   - 429: Too many requests (rate limited)
 *   - 500: Server error
 */
auth.post(
  '/login',
  rateLimitAuth,
  zValidator('json', authSchema, createValidationErrorHandler()),
  async (c) => {
    try {
      const { login, password } = c.req.valid('json')

      // Login user through auth service
      const result = await loginUser({ login, password })

      // Return session info and user data
      return c.json(result, 200)
    } catch (error) {
      // Handle known errors
      if (error instanceof Error && error.name === ERROR_NAMES.UNAUTHORIZED) {
        return c.json({ error: ERROR_MESSAGES.INVALID_CREDENTIALS }, 401)
      }

      logError('Login error', error)
      return c.json({ error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR }, 500)
    }
  }
)

/**
 * POST /auth/logout
 *
 * Invalidate current session (server-side revocation)
 * - Verifies Bearer token
 * - Marks session as revoked in database
 * - Returns success confirmation
 *
 * Auth: Authorization: Bearer <token>
 *
 * Response 200:
 *   {
 *     "ok": true
 *   }
 *
 * Errors:
 *   - 401: Missing, invalid, or expired token
 *   - 500: Server error
 */
auth.post('/logout', requireAuth, async (c) => {
  try {
    // Get JWT ID from authenticated context (attached by middleware)
    const jwtId = (c.req.raw as any).jwtId as string

    // Revoke the session
    await logoutUser(jwtId)

    // Return success
    return c.json({ ok: true }, 200)
  } catch (error) {
    logError('Logout error', error)
    return c.json({ error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR }, 500)
  }
})

/**
 * GET /auth/session
 *
 * Check if token is valid and not expired/revoked
 * - Verifies Bearer token
 * - Checks session is active and not revoked
 * - Returns user info and session validity
 *
 * Auth: Authorization: Bearer <token>
 *
 * Response 200:
 *   {
 *     "user_id": "u_xxxxx",
 *     "valid": true,
 *     "expires_at": 1730000000000
 *   }
 *
 * Errors:
 *   - 401: Invalid, expired, or revoked token
 */
auth.get('/session', requireAuth, async (c) => {
  try {
    // Get user info from authenticated context (attached by middleware)
    const userId = (c.req.raw as any).userId as string
    const jwtId = (c.req.raw as any).jwtId as string

    // Get session details from repository
    const session = await sessionRepository.findSessionByJwtId(jwtId)

    if (!session) {
      return c.json(
        {
          error: 'Session not found'
        },
        401
      )
    }

    // Return session info
    return c.json(
      {
        user_id: userId,
        valid: true,
        expires_at: session.expiresAt
      },
      200
    )
  } catch (error) {
    logError('Session check error', error)
    return c.json({ error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR }, 500)
  }
})

/**
 * POST /auth/refresh
 *
 * Refresh JWT token and extend session expiration
 * - Verifies current Bearer token
 * - Generates new JWT token with same jwtId
 * - Extends session expiration in database
 * - Returns new token and expiration
 * - Rate limited: 30 attempts per 5 minutes per user
 *
 * Auth: Authorization: Bearer <token>
 *
 * Response 200:
 *   {
 *     "token": "<new JWT>",
 *     "expires_at": 1730000000000
 *   }
 *
 * Errors:
 *   - 401: Invalid, expired, or revoked token
 *   - 429: Too many refresh requests
 *   - 500: Server error
 */
auth.post('/refresh', requireAuth, rateLimitRefresh, async (c) => {
  try {
    // Get user info from authenticated context
    const userId = (c.req.raw as any).userId as string
    const jwtId = (c.req.raw as any).jwtId as string

    // Refresh session through auth service
    const result = await refreshSession(jwtId)

    // Return new token and expiration
    return c.json(
      {
        token: result.token,
        expires_at: result.expiresAt
      },
      200
    )
  } catch (error) {
    // Handle known errors
    if (error instanceof Error && error.name === ERROR_NAMES.UNAUTHORIZED) {
      return c.json({ error: ERROR_MESSAGES.INVALID_SESSION }, 401)
    }

    logError('Token refresh error', error)
    return c.json({ error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR }, 500)
  }
})

export default auth
