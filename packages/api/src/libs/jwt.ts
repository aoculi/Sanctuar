// JWT utilities for session token generation and verification
import { SignJWT, jwtVerify } from 'jose'
import { config } from '../config'

/**
 * JWT payload structure
 */
interface JwtPayload {
  sub: string // user_id
  jti: string // JWT ID (unique session identifier)
  exp: number // Expiration timestamp (seconds)
  iat: number // Issued at timestamp (seconds)
}

/**
 * Generate a JWT token for a session
 * @param userId - User ID (sub claim)
 * @param jwtId - Unique JWT ID (jti claim)
 * @param expiresInMs - Token expiration in milliseconds (default: from config)
 * @returns Signed JWT token
 */
export async function generateToken(
  userId: string,
  jwtId: string,
  expiresInMs?: number
): Promise<string> {
  const secret = new TextEncoder().encode(config.jwt.secret)
  const now = Math.floor(Date.now() / 1000)

  // Parse expiration from config (e.g., "15m" -> 900 seconds)
  const expirationSeconds = expiresInMs
    ? Math.floor(expiresInMs / 1000)
    : parseExpirationTime(config.jwt.expiresIn)

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setJti(jwtId)
    .setIssuedAt(now)
    .setExpirationTime(now + expirationSeconds)
    .sign(secret)

  return token
}

/**
 * Verify and decode a JWT token
 * @param token - JWT token to verify
 * @returns Decoded payload if valid
 * @throws Error if token is invalid or expired
 */
export async function verifyToken(token: string): Promise<JwtPayload> {
  const secret = new TextEncoder().encode(config.jwt.secret)

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256']
    })

    return {
      sub: payload.sub!,
      jti: payload.jti!,
      exp: payload.exp!,
      iat: payload.iat!
    }
  } catch (error) {
    // Never log the token itself
    throw new Error('Invalid or expired token')
  }
}

/**
 * Parse expiration time string (e.g., "15m", "1h", "30s") to seconds
 * @param expiration - Expiration time string
 * @returns Expiration in seconds
 */
function parseExpirationTime(expiration: string): number {
  const match = expiration.match(/^(\d+)([smhd])$/)
  if (!match) {
    throw new Error(`Invalid expiration format: ${expiration}`)
  }

  const value = parseInt(match[1], 10)
  const unit = match[2]

  switch (unit) {
    case 's':
      return value
    case 'm':
      return value * 60
    case 'h':
      return value * 60 * 60
    case 'd':
      return value * 60 * 60 * 24
    default:
      throw new Error(`Invalid time unit: ${unit}`)
  }
}

/**
 * Get expiration timestamp in milliseconds
 * @param expiresInMs - Optional custom expiration in ms
 * @returns Expiration timestamp (epoch ms)
 */
export function getExpirationTimestamp(expiresInMs?: number): number {
  const expirationSeconds = expiresInMs
    ? Math.floor(expiresInMs / 1000)
    : parseExpirationTime(config.jwt.expiresIn)

  return Date.now() + expirationSeconds * 1000
}
