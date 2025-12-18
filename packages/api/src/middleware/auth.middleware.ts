// Authentication middleware - verifies JWT tokens and attaches user info to context
import { Context, Next } from 'hono'
import { ERROR_MESSAGES, logError } from '../libs/errors'
import { verifyToken } from '../libs/jwt'
import * as sessionRepository from '../repositories/session.repository'

/**
 * Extended context with authenticated user information
 */
export interface AuthContext {
  user: {
    userId: string
    jwtId: string
  }
}

/**
 * Middleware to verify JWT Bearer token
 * Attaches user info to context if valid
 * Returns 401 if token is missing, invalid, or session is revoked
 */
export async function requireAuth(c: Context, next: Next) {
  // Extract Bearer token from Authorization header
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: ERROR_MESSAGES.MISSING_AUTH_HEADER }, 401)
  }

  const token = authHeader.substring(7) // Remove "Bearer " prefix

  try {
    // Verify and decode JWT token
    const payload = await verifyToken(token)

    // Check if session exists and is not revoked
    const session = await sessionRepository.findSessionByJwtId(payload.jti)

    if (!session) {
      return c.json({ error: ERROR_MESSAGES.INVALID_SESSION }, 401)
    }

    if (session.revokedAt !== null) {
      return c.json({ error: ERROR_MESSAGES.SESSION_REVOKED }, 401)
    }

    // Check if session has expired
    if (session.expiresAt < Date.now()) {
      return c.json({ error: ERROR_MESSAGES.SESSION_EXPIRED }, 401)
    }

    // Attach user info to request object for downstream handlers
    ;(c.req.raw as any).jwtId = payload.jti
    ;(c.req.raw as any).userId = payload.sub

    await next()
  } catch (error) {
    logError('Token verification failed', error)
    return c.json({ error: ERROR_MESSAGES.INVALID_TOKEN }, 401)
  }
}
