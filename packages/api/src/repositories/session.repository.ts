// Session repository - handles all database operations for sessions
import { eq, lt } from 'drizzle-orm'
import { db } from '../database/db'
import { NewSession, sessions } from '../database/schema'

/**
 * Find a session by session ID
 * @param sessionId - The session ID to search for
 * @returns Session record or undefined if not found
 */
export async function findSessionById(sessionId: string) {
  const result = await db
    .select()
    .from(sessions)
    .where(eq(sessions.sessionId, sessionId))
    .limit(1)

  return result[0]
}

/**
 * Find a session by JWT ID (jti)
 * @param jwtId - The JWT ID to search for
 * @returns Session record or undefined if not found
 */
export async function findSessionByJwtId(jwtId: string) {
  const result = await db
    .select()
    .from(sessions)
    .where(eq(sessions.jwtId, jwtId))
    .limit(1)

  return result[0]
}

/**
 * Create a new session
 * @param sessionData - Session data to insert
 * @returns The created session record
 */
export async function createSession(sessionData: NewSession) {
  await db.insert(sessions).values(sessionData)

  return findSessionById(sessionData.sessionId)
}

/**
 * Revoke a session by session ID
 * @param sessionId - The session ID to revoke
 */
async function revokeSession(sessionId: string): Promise<void> {
  const now = Date.now()

  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(eq(sessions.sessionId, sessionId))
}

/**
 * Revoke a session by JWT ID
 * @param jwtId - The JWT ID to revoke
 */
export async function revokeSessionByJwtId(jwtId: string): Promise<void> {
  const now = Date.now()

  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(eq(sessions.jwtId, jwtId))
}

/**
 * Delete expired sessions (cleanup)
 * @param beforeTimestamp - Delete sessions expired before this timestamp
 * @returns Number of deleted sessions
 */
async function deleteExpiredSessions(beforeTimestamp: number): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, beforeTimestamp))
}

/**
 * Get all sessions for a user
 * @param userId - The user ID
 * @returns Array of session records
 */
async function findSessionsByUserId(userId: string) {
  return db.select().from(sessions).where(eq(sessions.userId, userId))
}

/**
 * Update session expiration time
 * @param jwtId - The JWT ID to update
 * @param expiresAt - New expiration timestamp
 */
export async function updateSessionExpiration(
  jwtId: string,
  expiresAt: number
): Promise<void> {
  await db.update(sessions).set({ expiresAt }).where(eq(sessions.jwtId, jwtId))
}
