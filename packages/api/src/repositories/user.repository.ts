// User repository - handles all database operations for users
import { eq } from 'drizzle-orm'
import { db } from '../database/db'
import { NewUser, users } from '../database/schema'

/**
 * Find a user by login (email/username)
 * @param login - The login to search for
 * @returns User record or undefined if not found
 */
export async function findUserByLogin(login: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.login, login))
    .limit(1)

  return result[0]
}

/**
 * Find a user by user ID
 * @param userId - The user ID to search for
 * @returns User record or undefined if not found
 */
export async function findUserById(userId: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.userId, userId))
    .limit(1)

  return result[0]
}

/**
 * Check if a login already exists
 * @param login - The login to check
 * @returns True if login exists, false otherwise
 */
export async function loginExists(login: string): Promise<boolean> {
  const result = await db
    .select({ userId: users.userId })
    .from(users)
    .where(eq(users.login, login))
    .limit(1)

  return result.length > 0
}

/**
 * Create a new user
 * @param userData - User data to insert
 * @returns The created user record
 */
export async function createUser(userData: NewUser) {
  await db.insert(users).values(userData)

  // Fetch and return the created user
  return findUserById(userData.userId)
}

/**
 * Update user's wrapped master key (WMK)
 * @param userId - The user ID to update
 * @param wmkData - WMK nonce and ciphertext
 * @returns The updated user record
 */
export async function updateUserWmk(
  userId: string,
  wmkData: {
    wmkNonce: Buffer
    wmkCiphertext: Buffer
    wmkLabel?: string
  }
) {
  const now = Date.now()

  await db
    .update(users)
    .set({
      ...wmkData,
      updatedAt: now
    })
    .where(eq(users.userId, userId))

  return findUserById(userId)
}
