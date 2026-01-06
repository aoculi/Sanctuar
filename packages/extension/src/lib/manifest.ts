/**
 * Manifest decryption utilities
 *
 * This module provides a clean, dedicated interface for decrypting
 * the vault manifest. It centralizes all manifest-related crypto logic.
 */

import { constructAadManifest, STORAGE_KEYS } from '@/lib/constants'
import {
  base64ToUint8Array,
  decryptAEAD,
  encryptAEAD,
  uint8ArrayToBase64,
  zeroize
} from '@/lib/crypto'
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
export function createEmptyManifest(version: number): ManifestV1 {
  return {
    version,
    items: [],
    tags: [],
    collections: []
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
    collections: Array.isArray(manifest.collections)
      ? manifest.collections
      : [],
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

/**
 * Encrypted manifest payload ready for API
 */
export type EncryptedManifestPayload = {
  version: number
  nonce: string
  ciphertext: string
}

/**
 * Manifest encryption error types
 */
export class ManifestEncryptionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'ManifestEncryptionError'
  }
}

/**
 * Encrypts a manifest for storage on the server
 *
 * @param manifest - The manifest to encrypt
 * @param nextVersion - The version number for this manifest
 * @returns The encrypted manifest payload ready for API
 * @throws KeysNotAvailableError if the vault is locked
 * @throws ManifestEncryptionError if encryption fails
 */
export async function encryptManifest(
  manifest: ManifestV1,
  nextVersion: number
): Promise<EncryptedManifestPayload> {
  // Ensure crypto environment (libsodium) is initialized
  await whenCryptoReady()

  // Retrieve keys from storage
  const keystoreData = await getStorageItem<KeystoreData>(STORAGE_KEYS.KEYSTORE)

  if (!keystoreData) {
    throw new KeysNotAvailableError()
  }

  const { mak: makBase64, aadContext } = keystoreData
  const mak = base64ToUint8Array(makBase64)

  try {
    // Build AAD for manifest encryption
    const aad = new TextEncoder().encode(
      constructAadManifest(aadContext.userId, aadContext.vaultId)
    )

    // Serialize and encrypt
    const plaintext = new TextEncoder().encode(JSON.stringify(manifest))
    const { nonce, ciphertext } = encryptAEAD(plaintext, mak, aad)

    return {
      version: nextVersion,
      nonce: uint8ArrayToBase64(nonce),
      ciphertext: uint8ArrayToBase64(ciphertext)
    }
  } catch (error) {
    if (error instanceof ManifestDecryptionError) {
      throw error
    }
    throw new ManifestEncryptionError('Failed to encrypt manifest', error)
  } finally {
    zeroize(mak)
  }
}

/**
 * Input for saving a manifest
 */
export type SaveManifestInput = {
  manifest: ManifestV1
  etag: string | null
  serverVersion: number
  /** Base snapshot for 3-way merge on conflict (optional, enables conflict resolution) */
  baseSnapshot?: ManifestV1
}

/**
 * Response after saving a manifest
 */
export type SaveManifestResult = {
  vault_id: string
  version: number
  etag: string
  updated_at: number
  manifest: ManifestV1
  /** True if a conflict was resolved via 3-way merge */
  conflictResolved?: boolean
}

/**
 * API functions required for saving with conflict resolution
 */
export type SaveManifestApi = {
  save: (payload: {
    body: EncryptedManifestPayload
    headers?: Record<string, string>
  }) => Promise<{
    vault_id: string
    version: number
    etag: string
    updated_at: number
  }>
  /** Fetch latest manifest (for conflict resolution) */
  fetch: () => Promise<EncryptedManifest>
}

/**
 * Encrypts and saves a manifest to the server with automatic conflict resolution
 *
 * On 409 conflict:
 * 1. Fetches the latest server manifest
 * 2. Performs 3-way merge (base, local, remote)
 * 3. Retries save with merged result
 *
 * @param input - The manifest data and version info
 * @param api - API functions for save and fetch
 * @returns The save result with updated etag and version
 */
export async function saveManifest(
  input: SaveManifestInput,
  api: SaveManifestApi
): Promise<SaveManifestResult> {
  const { manifest, etag, serverVersion, baseSnapshot } = input

  const attemptSave = async (
    manifestToSave: ManifestV1,
    version: number,
    currentEtag: string | null
  ) => {
    const encrypted = await encryptManifest(manifestToSave, version + 1)

    const isFirstWrite = version === 0
    const headers: Record<string, string> = {}
    if (!isFirstWrite && currentEtag) {
      headers['If-Match'] = currentEtag
    }

    return api.save({ body: encrypted, headers })
  }

  try {
    const response = await attemptSave(manifest, serverVersion, etag)
    return { ...response, manifest }
  } catch (error: unknown) {
    // Handle conflict (409)
    if (isConflictError(error) && baseSnapshot) {
      const { threeWayMerge } = await import('@/lib/conflictResolution')

      // Fetch latest from server
      const serverData = await api.fetch()
      const remoteManifest = await decryptManifest(serverData)

      // 3-way merge
      const resolution = threeWayMerge({
        base: baseSnapshot,
        local: manifest,
        remote: remoteManifest
      })

      // Retry with merged manifest
      const response = await attemptSave(
        resolution.merged,
        serverData.version,
        serverData.etag
      )

      return {
        ...response,
        manifest: resolution.merged,
        conflictResolved: true
      }
    }

    throw error
  }
}

/**
 * Check if an error is a 409 conflict
 */
function isConflictError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: number }).status === 409
  )
}
