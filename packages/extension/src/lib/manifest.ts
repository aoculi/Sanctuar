/**
 * Manifest decryption utilities
 *
 * This module provides a clean, dedicated interface for decrypting
 * the vault manifest. It centralizes all manifest-related crypto logic.
 */

import { constructAadManifest, STORAGE_KEYS } from '@/lib/constants'
import { base64ToUint8Array, decryptAEAD, zeroize } from '@/lib/crypto'
import { whenCryptoReady } from '@/lib/cryptoEnv'
import { getStorageItem } from '@/lib/storage'
import type { ManifestV1 } from '@/lib/types'
import type { KeystoreData } from '@/lib/unlock'

/**
 * Encrypted manifest response from API
 */
export type EncryptedManifest = {
  vault_id: string
  version: number
  etag: string
  nonce: string
  ciphertext: string
  size?: number
  updated_at: number
}

/**
 * Manifest decryption error types
 */
export class ManifestDecryptionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'ManifestDecryptionError'
  }
}

export class KeysNotAvailableError extends ManifestDecryptionError {
  constructor() {
    super('Keys not available for decryption. Vault may be locked.')
    this.name = 'KeysNotAvailableError'
  }
}

export class InvalidManifestError extends ManifestDecryptionError {
  constructor(cause?: unknown) {
    super('Failed to parse decrypted manifest data', cause)
    this.name = 'InvalidManifestError'
  }
}

/**
 * Creates an empty manifest with the given version
 */
function createEmptyManifest(version: number): ManifestV1 {
  return {
    version,
    items: [],
    tags: []
  }
}

/**
 * Validates and normalizes a parsed manifest object
 * Ensures required fields are present with valid defaults
 */
function normalizeManifest(data: unknown, version: number): ManifestV1 {
  if (!data || typeof data !== 'object') {
    return createEmptyManifest(version)
  }

  const manifest = data as Partial<ManifestV1>

  return {
    version: manifest.version ?? version,
    items: Array.isArray(manifest.items) ? manifest.items : [],
    tags: Array.isArray(manifest.tags) ? manifest.tags : [],
    chain_head: manifest.chain_head
  }
}

/**
 * Decrypts an encrypted manifest using the stored MAK key
 *
 * This is the main function to use for manifest decryption.
 * It handles all crypto initialization, key retrieval, and cleanup.
 *
 * @param encryptedManifest - The encrypted manifest from the API
 * @returns The decrypted and parsed ManifestV1
 * @throws KeysNotAvailableError if the vault is locked
 * @throws ManifestDecryptionError if decryption fails
 */
export async function decryptManifest(
  encryptedManifest: EncryptedManifest
): Promise<ManifestV1> {
  // Ensure crypto environment (libsodium) is initialized
  await whenCryptoReady()

  // Retrieve keys from storage
  const keystoreData = await getStorageItem<KeystoreData>(STORAGE_KEYS.KEYSTORE)

  if (!keystoreData) {
    throw new KeysNotAvailableError()
  }

  const { mak: makBase64, aadContext } = keystoreData
  const mak = base64ToUint8Array(makBase64)

  let plaintext: Uint8Array | undefined

  try {
    // Build AAD for manifest decryption
    const aad = new TextEncoder().encode(
      constructAadManifest(aadContext.userId, aadContext.vaultId)
    )

    // Decrypt the manifest
    plaintext = decryptAEAD(
      base64ToUint8Array(encryptedManifest.ciphertext),
      base64ToUint8Array(encryptedManifest.nonce),
      mak,
      aad
    )

    // Decode and parse
    const manifestText = new TextDecoder().decode(plaintext)
    const parsedData = JSON.parse(manifestText)

    return normalizeManifest(parsedData, encryptedManifest.version)
  } catch (error) {
    // If it's already our error type, rethrow
    if (error instanceof ManifestDecryptionError) {
      throw error
    }

    // Wrap other errors
    throw new ManifestDecryptionError('Failed to decrypt manifest', error)
  } finally {
    // Always zeroize sensitive data
    zeroize(mak)
    if (plaintext) {
      zeroize(plaintext)
    }
  }
}

/**
 * Checks if the keystore has the required keys for manifest decryption
 * Useful to check before attempting decryption
 */
export async function canDecryptManifest(): Promise<boolean> {
  try {
    const keystoreData = await getStorageItem<KeystoreData>(
      STORAGE_KEYS.KEYSTORE
    )
    return Boolean(
      keystoreData?.mak &&
      keystoreData?.aadContext?.userId &&
      keystoreData?.aadContext?.vaultId
    )
  } catch {
    return false
  }
}
