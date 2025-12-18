// Rate limiting middleware - protects auth endpoints from brute force attacks
import type { Context, Next } from 'hono'
import { config } from '../config'

/**
 * Rate limit entry tracking attempts and reset time
 */
interface RateLimitEntry {
  attempts: number
  resetAt: number // Timestamp when the counter resets
}

/**
 * In-memory storage for rate limiting
 * - ipLimits: Track attempts per IP address
 * - loginLimits: Track attempts per login identifier
 * - refreshLimits: Track refresh attempts per user ID
 */
const rateLimitStore = {
  ipLimits: new Map<string, RateLimitEntry>(),
  loginLimits: new Map<string, RateLimitEntry>(),
  refreshLimits: new Map<string, RateLimitEntry>()
}

/**
 * Cleanup old entries from the rate limit store
 * Removes entries that have expired (past their reset time)
 */
function cleanupExpiredEntries() {
  const now = Date.now()

  // Clean IP limits
  for (const [key, entry] of rateLimitStore.ipLimits.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.ipLimits.delete(key)
    }
  }

  // Clean login limits
  for (const [key, entry] of rateLimitStore.loginLimits.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.loginLimits.delete(key)
    }
  }

  // Clean refresh limits
  for (const [key, entry] of rateLimitStore.refreshLimits.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.refreshLimits.delete(key)
    }
  }
}

/**
 * Check and update rate limit for a given key
 * @param store - Map to check/update
 * @param key - Identifier (IP or login)
 * @returns Object with isLimited flag and secondsUntilReset
 */
function checkRateLimit(
  store: Map<string, RateLimitEntry>,
  key: string
): { isLimited: boolean; secondsUntilReset: number } {
  const now = Date.now()
  const { maxAttempts, windowMs } = config.rateLimit.auth

  const entry = store.get(key)

  // No entry or expired - create new entry
  if (!entry || now >= entry.resetAt) {
    store.set(key, {
      attempts: 1,
      resetAt: now + windowMs
    })
    return { isLimited: false, secondsUntilReset: 0 }
  }

  // Entry exists and is still valid
  entry.attempts += 1

  // Check if limit exceeded
  if (entry.attempts > maxAttempts) {
    const secondsUntilReset = Math.ceil((entry.resetAt - now) / 1000)
    return { isLimited: true, secondsUntilReset }
  }

  return { isLimited: false, secondsUntilReset: 0 }
}

/**
 * Get client IP from request
 * Handles proxied requests and direct connections
 * @param c - Hono context
 * @returns IP address or 'unknown'
 */
function getClientIp(c: Context): string {
  // Check X-Forwarded-For header (if behind proxy)
  const forwarded = c.req.header('x-forwarded-for')
  if (forwarded) {
    // Take the first IP in the chain
    return forwarded.split(',')[0].trim()
  }

  // Check X-Real-IP header
  const realIp = c.req.header('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback to direct connection (for local testing, this will be 127.0.0.1)
  return c.req.header('cf-connecting-ip') || '127.0.0.1'
}

/**
 * Rate limiting middleware for authentication endpoints
 * Tracks requests by both IP address and login identifier
 * Returns 429 Too Many Requests with Retry-After header when limits exceeded
 *
 * Configuration:
 * - 5 attempts per minute per IP
 * - 5 attempts per minute per login key
 *
 * @returns Hono middleware function
 */
export async function rateLimitAuth(c: Context, next: Next) {
  // Cleanup expired entries periodically (on each request)
  cleanupExpiredEntries()

  // Get client IP
  const clientIp = getClientIp(c)

  // Check IP-based rate limit
  const ipLimit = checkRateLimit(rateLimitStore.ipLimits, clientIp)
  if (ipLimit.isLimited) {
    return c.json(
      {
        error: 'Too many requests. Please try again later.'
      },
      429,
      {
        'Retry-After': ipLimit.secondsUntilReset.toString(),
        'X-RateLimit-Limit': config.rateLimit.auth.maxAttempts.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': ipLimit.secondsUntilReset.toString()
      }
    )
  }

  // Check login-based rate limit (if login is provided in request body)
  // We need to clone the request to peek at the body without consuming it
  try {
    // Clone the request so we can read the body
    const clonedReq = c.req.raw.clone()
    const body = await clonedReq.json()

    if (body && typeof (body as { login: string }).login === 'string') {
      const login = (body as { login: string }).login.toLowerCase().trim()
      const loginLimit = checkRateLimit(rateLimitStore.loginLimits, login)

      if (loginLimit.isLimited) {
        return c.json(
          {
            error: 'Too many requests for this account. Please try again later.'
          },
          429,
          {
            'Retry-After': loginLimit.secondsUntilReset.toString(),
            'X-RateLimit-Limit': config.rateLimit.auth.maxAttempts.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': loginLimit.secondsUntilReset.toString()
          }
        )
      }
    }
  } catch (error) {
    // If body parsing fails, just continue with IP-based limiting
    // The actual request handler will handle the invalid JSON
  }

  await next()
}

/**
 * Clear all rate limit data (useful for testing)
 */
export function clearRateLimits() {
  rateLimitStore.ipLimits.clear()
  rateLimitStore.loginLimits.clear()
  rateLimitStore.refreshLimits.clear()
}

/**
 * Get current rate limit stats (useful for testing/debugging)
 */
export function getRateLimitStats() {
  return {
    ipLimits: rateLimitStore.ipLimits.size,
    loginLimits: rateLimitStore.loginLimits.size,
    refreshLimits: rateLimitStore.refreshLimits.size
  }
}

/**
 * Rate limiting middleware for token refresh endpoint
 * More lenient than auth endpoints since refresh is called frequently
 * Tracks requests by user ID (from JWT)
 * Returns 429 Too Many Requests with Retry-After header when limits exceeded
 *
 * Configuration:
 * - 30 attempts per 5 minutes per user
 *
 * @returns Hono middleware function
 */
export async function rateLimitRefresh(c: Context, next: Next) {
  // Cleanup expired entries periodically
  cleanupExpiredEntries()

  // Get user ID from authenticated context (set by requireAuth middleware)
  const userId = (c.req.raw as any).userId as string
  if (!userId) {
    // If no userId, something went wrong with auth - let requireAuth handle it
    await next()
    return
  }

  // Use a separate store for refresh rate limiting
  // More lenient: 30 attempts per 5 minutes
  const maxAttempts = 30
  const windowMs = 5 * 60 * 1000 // 5 minutes

  const entry = rateLimitStore.refreshLimits.get(userId)
  const now = Date.now()

  // No entry or expired - create new entry
  if (!entry || now >= entry.resetAt) {
    rateLimitStore.refreshLimits.set(userId, {
      attempts: 1,
      resetAt: now + windowMs
    })
    await next()
    return
  }

  // Entry exists and is still valid
  entry.attempts += 1

  // Check if limit exceeded
  if (entry.attempts > maxAttempts) {
    const secondsUntilReset = Math.ceil((entry.resetAt - now) / 1000)
    return c.json(
      {
        error: 'Too many refresh requests. Please try again later.'
      },
      429,
      {
        'Retry-After': secondsUntilReset.toString(),
        'X-RateLimit-Limit': maxAttempts.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': secondsUntilReset.toString()
      }
    )
  }

  await next()
}
