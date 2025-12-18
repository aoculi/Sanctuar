// Cryptographic utilities for password hashing and salt generation
import { Algorithm, hash, verify } from '@node-rs/argon2'
import { config } from '../config'

/**
 * Generate a raw binary salt
 * @param length - Length of the salt in bytes (default: 32)
 * @returns Buffer containing random bytes
 */
export function generateSaltBuffer(length: number = 32): Buffer {
  const buffer = new Uint8Array(length)
  crypto.getRandomValues(buffer)
  return Buffer.from(buffer)
}

/**
 * Hash a password using Argon2id with AUTH parameters
 * This is used for server-side password verification
 * @param password - Plain text password
 * @param salt - Optional salt (will generate if not provided)
 * @returns PHC string format (includes algorithm, params, salt, and hash)
 */
export async function hashPassword(password: string): Promise<string> {
  const { memoryCost, timeCost, parallelism } = config.argon2.auth

  const phcString = await hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost,
    timeCost,
    parallelism,
    outputLen: 32 // 32 bytes hash output
  })

  return phcString
}

/**
 * Verify a password against a stored Argon2id hash
 * @param hash - PHC string from database
 * @param password - Plain text password to verify
 * @returns True if password matches
 */
export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  try {
    return await verify(hash, password)
  } catch (error) {
    // Never log the password or hash
    console.error(
      'Password verification failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    return false
  }
}

/**
 * Generate KDF parameters for client-side UEK derivation
 * Returns the parameters that the client will use to derive their User Encryption Key
 * @returns KDF parameters object
 */
export function generateKdfParams(): {
  algo: string
  salt: string
  m: number
  t: number
  p: number
  saltBuffer: Buffer
  hkdfSalt: string
  hkdfSaltBuffer: Buffer
} {
  const { memoryCost, timeCost, parallelism, saltLength, hkdfSaltLength } =
    config.argon2.kdf
  const saltBuffer = generateSaltBuffer(saltLength)
  const hkdfSaltBuffer = generateSaltBuffer(hkdfSaltLength)

  return {
    algo: 'argon2id',
    salt: saltBuffer.toString('base64'),
    m: memoryCost,
    t: timeCost,
    p: parallelism,
    saltBuffer, // Return raw buffer for database storage
    hkdfSalt: hkdfSaltBuffer.toString('base64'),
    hkdfSaltBuffer // Return raw buffer for database storage
  }
}
