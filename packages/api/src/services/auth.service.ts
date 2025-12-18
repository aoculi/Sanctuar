// Authentication service - handles user registration and login
import { nanoid } from 'nanoid'
import { formatKdfParams, formatWrappedMk } from '../libs/auth-helpers'
import { generateKdfParams, hashPassword, verifyPassword } from '../libs/crypto'
import {
  createConflictError,
  createUnauthorizedError,
  logError
} from '../libs/errors'
import { generateToken, getExpirationTimestamp } from '../libs/jwt'
import * as sessionRepository from '../repositories/session.repository'
import * as userRepository from '../repositories/user.repository'

export interface RegisterUserInput {
  login: string
  password: string
}

export interface RegisterUserOutput {
  user_id: string
  kdf: {
    algo: string
    salt: string
    m: number
    t: number
    p: number
    hkdf_salt?: string | null
  }
}

export interface LoginUserInput {
  login: string
  password: string
}

export interface LoginUserOutput {
  user_id: string
  token: string
  expires_at: number
  kdf: {
    algo: string
    salt: string
    m: number
    t: number
    p: number
  }
  wrapped_mk: string | null
}

export interface RefreshSessionOutput {
  token: string
  expiresAt: number
}

/**
 * Register a new user
 * - Checks login availability
 * - Hashes password with Argon2id (AUTH parameters)
 * - Generates KDF parameters for client-side UEK derivation
 * - Stores user credentials securely
 * @throws Error if login already exists or registration fails
 */
export const registerUser = async (
  input: RegisterUserInput
): Promise<RegisterUserOutput> => {
  const { login, password } = input

  console.log('registerUser')
  // Check if login already exists
  const exists = await userRepository.loginExists(login)
  if (exists) {
    throw createConflictError()
  }

  // Generate user ID
  const userId = `u_${nanoid(21)}`

  // Hash password with Argon2id (AUTH parameters) - generates its own salt
  const authHash = await hashPassword(password)

  // Generate KDF parameters for client-side UEK derivation
  const kdfParams = generateKdfParams()

  // Get current timestamp
  const now = Date.now()

  // Insert user into database
  try {
    await userRepository.createUser({
      userId,
      login,
      authHash,
      kdfAlgo: kdfParams.algo,
      kdfSalt: kdfParams.saltBuffer,
      kdfM: kdfParams.m,
      kdfT: kdfParams.t,
      kdfP: kdfParams.p,
      hkdfSalt: kdfParams.hkdfSaltBuffer,
      createdAt: now,
      updatedAt: now
    })

    console.log(`User registered successfully: ${userId}`)

    // Return only what client needs for UEK derivation
    return {
      user_id: userId,
      kdf: {
        algo: kdfParams.algo,
        salt: kdfParams.salt,
        m: kdfParams.m,
        t: kdfParams.t,
        p: kdfParams.p,
        hkdf_salt: kdfParams.hkdfSalt
      }
    }
  } catch (error) {
    logError('User registration failed', error)
    throw new Error('Failed to register user')
  }
}

/**
 * Login user and create session
 * - Verifies password against stored hash
 * - Creates session and generates JWT token
 * - Returns user info, token, and KDF parameters
 * @throws Error if credentials are invalid
 */
export const loginUser = async (
  input: LoginUserInput
): Promise<LoginUserOutput> => {
  const { login, password } = input

  // Lookup user by login
  const user = await userRepository.findUserByLogin(login)
  if (!user) {
    throw createUnauthorizedError()
  }

  // Verify password (constant-time compare via Argon2id)
  const isValid = await verifyPassword(user.authHash, password)
  if (!isValid) {
    console.log(`Login failed for user: ${user.userId}`)
    throw createUnauthorizedError()
  }

  // Generate session ID and JWT ID
  const sessionId = `s_${nanoid(21)}`
  const jwtId = `jti_${nanoid(21)}`

  // Calculate expiration
  const expiresAt = getExpirationTimestamp()

  // Generate JWT token
  const token = await generateToken(user.userId, jwtId)

  // Create session record
  try {
    await sessionRepository.createSession({
      sessionId,
      userId: user.userId,
      jwtId,
      expiresAt,
      createdAt: Date.now()
    })

    console.log(`User logged in successfully: ${user.userId}`)

    // Return session info and KDF parameters
    return {
      user_id: user.userId,
      token,
      expires_at: expiresAt,
      kdf: formatKdfParams(user),
      wrapped_mk: formatWrappedMk(user)
    }
  } catch (error) {
    logError('Session creation failed', error)
    throw new Error('Failed to create session')
  }
}

/**
 * Logout user and revoke session
 * - Marks the session as revoked
 * @param jwtId - JWT ID from the verified token
 */
export const logoutUser = async (jwtId: string): Promise<void> => {
  try {
    // Revoke the session by JWT ID
    await sessionRepository.revokeSessionByJwtId(jwtId)

    console.log(`Session revoked: ${jwtId}`)
  } catch (error) {
    logError('Session revocation failed', error)
    throw new Error('Failed to revoke session')
  }
}

/**
 * Refresh session token and extend expiration
 * - Verifies session exists and is not revoked
 * - Generates new JWT token with same jwtId
 * - Updates session expiration in database
 * @param jwtId - JWT ID from the verified token
 * @throws Error if session is invalid or refresh fails
 */
export const refreshSession = async (
  jwtId: string
): Promise<RefreshSessionOutput> => {
  // Get current session
  const session = await sessionRepository.findSessionByJwtId(jwtId)

  if (!session) {
    throw createUnauthorizedError()
  }

  if (session.revokedAt !== null) {
    throw createUnauthorizedError()
  }

  // Check if session has already expired
  if (session.expiresAt < Date.now()) {
    throw createUnauthorizedError()
  }

  // Calculate new expiration (extend by configured JWT expiration time)
  const newExpiresAt = getExpirationTimestamp()

  // Generate new JWT token with same jwtId and userId
  // This allows seamless refresh without creating a new session
  const token = await generateToken(session.userId, jwtId)

  // Update session expiration in database
  try {
    await sessionRepository.updateSessionExpiration(jwtId, newExpiresAt)

    console.log(`Session refreshed: ${jwtId}`)

    return {
      token,
      expiresAt: newExpiresAt
    }
  } catch (error) {
    logError('Session refresh failed', error)
    throw new Error('Failed to refresh session')
  }
}
