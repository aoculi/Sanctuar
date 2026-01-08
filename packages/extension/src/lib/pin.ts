/**
 * PIN cryptography utilities
 *
 * Security model:
 * - PIN is hashed with Argon2id for verification (with conservative parameters since it's only 6 digits)
 * - PIN-derived key is used to encrypt the MAK
 * - After 3 failed attempts, require full password login
 * - PIN cannot be used to derive UEK (password still required for initial login)
 */

import {
  base64ToUint8Array,
  decryptAEAD,
  encryptAEAD,
  uint8ArrayToBase64,
  zeroize
} from '@/lib/crypto'
import { getCryptoEnv, whenCryptoReady } from '@/lib/cryptoEnv'
import type { AadContext, PinStoreData } from '@/lib/storage'
import type { KeystoreData } from '@/lib/unlock'
import { argon2id } from 'hash-wasm'

// PIN-specific KDF parameters (lighter than password since PIN is shorter)
export const PIN_KDF = {
  parallelism: 1,
  iterations: 3,
  memorySize: 64 * 1024, // 64MB (lighter than password)
  hashLength: 32
}

export const PIN_FAILED_ATTEMPTS_THRESHOLD = 3

/**
 * Hash PIN for verification using Argon2id
 */
export async function hashPin(
  pin: string,
  salt: Uint8Array
): Promise<Uint8Array> {
  const hash = await argon2id({
    password: pin,
    salt,
    parallelism: PIN_KDF.parallelism,
    iterations: PIN_KDF.iterations,
    memorySize: PIN_KDF.memorySize,
    hashLength: PIN_KDF.hashLength,
    outputType: 'binary'
  })
  return hash as Uint8Array
}

/**
 * Derive encryption key from PIN using Argon2id
 */
export async function derivePinKey(
  pin: string,
  salt: Uint8Array
): Promise<Uint8Array> {
  return await hashPin(pin, salt)
}

/**
 * Verify PIN against stored hash using constant-time comparison
 */
export async function verifyPin(
  pin: string,
  pinStoreData: PinStoreData
): Promise<boolean> {
  await whenCryptoReady()

  const salt = base64ToUint8Array(pinStoreData.pinHashSalt)
  const computedHash = await hashPin(pin, salt)
  const storedHash = base64ToUint8Array(pinStoreData.pinHash)

  // Constant-time comparison using libsodium
  const sodium = getCryptoEnv()
  const isValid = sodium.memcmp(computedHash, storedHash)

  zeroize(computedHash, salt)
  return isValid
}

/**
 * Encrypt MAK with PIN-derived key
 */
export async function encryptMakWithPin(
  mak: Uint8Array,
  pin: string,
  userId: string,
  vaultId: string
): Promise<{ encryptedMak: string; pinKeySalt: string }> {
  await whenCryptoReady()

  const sodium = getCryptoEnv()

  // Generate salt for PIN key derivation
  const pinKeySalt = sodium.randombytes_buf(32)

  // Derive encryption key from PIN
  const pinKey = await derivePinKey(pin, pinKeySalt)

  // Create AAD for PIN-encrypted MAK
  const aad = new TextEncoder().encode(`${userId}|${vaultId}|pin_mak_v1`)

  // Encrypt MAK
  const { nonce, ciphertext } = encryptAEAD(mak, pinKey, aad)

  // Combine nonce and ciphertext
  const combined = new Uint8Array(24 + ciphertext.length)
  combined.set(nonce, 0)
  combined.set(ciphertext, 24)

  const encryptedMak = uint8ArrayToBase64(combined)
  const pinKeySaltB64 = uint8ArrayToBase64(pinKeySalt)

  zeroize(pinKey, pinKeySalt, nonce)

  return { encryptedMak, pinKeySalt: pinKeySaltB64 }
}

/**
 * Decrypt MAK with PIN
 */
export async function decryptMakWithPin(
  pin: string,
  pinStoreData: PinStoreData
): Promise<Uint8Array> {
  const pinKeySalt = base64ToUint8Array(pinStoreData.pinKeySalt)
  const pinKey = await derivePinKey(pin, pinKeySalt)

  const encryptedData = base64ToUint8Array(pinStoreData.encryptedMak)
  const nonce = encryptedData.subarray(0, 24)
  const ciphertext = encryptedData.subarray(24)

  const aad = new TextEncoder().encode(
    `${pinStoreData.userId}|${pinStoreData.vaultId}|pin_mak_v1`
  )

  try {
    const mak = decryptAEAD(ciphertext, nonce, pinKey, aad)
    zeroize(pinKey, pinKeySalt)
    return mak
  } catch (error) {
    zeroize(pinKey, pinKeySalt)
    throw new Error('PIN verification failed')
  }
}

/**
 * Setup PIN - create PIN store from password unlock
 */
export async function setupPin(
  pin: string,
  keystoreData: KeystoreData,
  userId: string,
  vaultId: string
): Promise<PinStoreData> {
  await whenCryptoReady()

  const sodium = getCryptoEnv()

  // Generate salts
  const pinHashSalt = sodium.randombytes_buf(32)

  // Hash PIN for verification
  const pinHash = await hashPin(pin, pinHashSalt)

  // Get MAK from keystore (it's already base64 encoded)
  const mak = base64ToUint8Array(keystoreData.mak)

  // Encrypt MAK with PIN
  const { encryptedMak, pinKeySalt } = await encryptMakWithPin(
    mak,
    pin,
    userId,
    vaultId
  )

  // Create PIN store
  const pinStoreData: PinStoreData = {
    pinHash: uint8ArrayToBase64(pinHash),
    pinHashSalt: uint8ArrayToBase64(pinHashSalt),
    pinKeySalt,
    encryptedMak,
    aadContext: keystoreData.aadContext,
    userId,
    vaultId,
    version: 1
  }

  zeroize(pinHash, pinHashSalt, mak)

  return pinStoreData
}
