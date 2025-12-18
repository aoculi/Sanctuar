// Vault service - handles vault business logic
import { nanoid } from 'nanoid'
import { config } from '../config'
import { computeEtag } from '../libs/etag'
import * as vaultRepository from '../repositories/vault.repository'

export interface VaultMetadataOutput {
  vault_id: string
  version: number
  bytes_total: number
  has_manifest: boolean
  updated_at: number
}

export interface ManifestOutput {
  vault_id: string
  version: number
  etag: string
  nonce: string
  ciphertext: string
  size: number
  updated_at: number
}

export interface UpsertManifestInput {
  version: number
  nonce: string
  ciphertext: string
  size?: number
}

export interface UpsertManifestOutput {
  vault_id: string
  version: number
  etag: string
  updated_at: number
}

/**
 * Get vault metadata for a user
 * - Lazily creates vault if it doesn't exist
 * - Checks if manifest exists
 * - Returns vault metadata
 * @param userId - The user ID from the authenticated token
 * @returns Vault metadata
 */
export const getVaultMetadata = async (
  userId: string
): Promise<VaultMetadataOutput> => {
  try {
    // Try to find existing vault by user ID
    let vault = await vaultRepository.findVaultByUserId(userId)

    // If vault doesn't exist, create it lazily
    if (!vault) {
      // Generate vault ID with vlt_ prefix
      const vaultId = `vlt_${nanoid(21)}`
      const now = Date.now()

      vault = await vaultRepository.createVault({
        vaultId,
        userId,
        version: 0,
        bytesTotal: 0,
        updatedAt: now
      })

      // Log vault creation (no sensitive data)
      console.log(`Vault created for user: ${userId}`)
    }

    // Check if manifest exists for this vault
    const hasManifest = await vaultRepository.manifestExists(vault.vaultId)

    // Return vault metadata
    return {
      vault_id: vault.vaultId,
      version: vault.version,
      bytes_total: vault.bytesTotal,
      has_manifest: hasManifest,
      updated_at: vault.updatedAt
    }
  } catch (error) {
    // Log error without sensitive data
    console.error(
      'Get vault metadata failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw new Error('Failed to retrieve vault metadata')
  }
}

/**
 * Get manifest for a user's vault
 * - Returns encrypted manifest blob
 * - Throws NotFoundError if manifest doesn't exist
 * @param userId - The user ID from the authenticated token
 * @returns Manifest data
 */
export const getManifest = async (userId: string): Promise<ManifestOutput> => {
  try {
    // Find vault by user ID
    const vault = await vaultRepository.findVaultByUserId(userId)

    if (!vault) {
      const error = new Error('Manifest not found')
      error.name = 'NotFoundError'
      throw error
    }

    // Get manifest by vault ID
    const manifest = await vaultRepository.getManifestByVaultId(vault.vaultId)

    if (!manifest) {
      const error = new Error('Manifest not found')
      error.name = 'NotFoundError'
      throw error
    }

    // Return manifest data (cast blobs to Buffer for TypeScript)
    const nonce = manifest.nonce as Buffer
    const ciphertext = manifest.ciphertext as Buffer

    return {
      vault_id: vault.vaultId,
      version: manifest.version,
      etag: manifest.etag,
      nonce: nonce.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      size: manifest.size,
      updated_at: manifest.updatedAt
    }
  } catch (error) {
    // Re-throw NotFoundError
    if (error instanceof Error && error.name === 'NotFoundError') {
      throw error
    }

    // Log error without sensitive data
    console.error(
      'Get manifest failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw new Error('Failed to retrieve manifest')
  }
}

/**
 * Create or update manifest with optimistic concurrency control
 * - Validates version sequencing
 * - Validates ETag for updates (version > 1)
 * - Computes new ETag
 * - Updates vault metadata
 * @param userId - The user ID from the authenticated token
 * @param input - Manifest data
 * @param ifMatch - If-Match header value (ETag for concurrency control)
 * @returns Updated manifest metadata
 */
export const upsertManifest = async (
  userId: string,
  input: UpsertManifestInput,
  ifMatch?: string
): Promise<{ output: UpsertManifestOutput; isNew: boolean }> => {
  try {
    // Validate base64 format (must match base64 pattern)
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/

    if (!base64Regex.test(input.nonce) || !base64Regex.test(input.ciphertext)) {
      const error = new Error('Invalid base64 encoding')
      error.name = 'ValidationError'
      throw error
    }

    // Decode base64 nonce and ciphertext
    let nonceBuffer: Buffer
    let ciphertextBuffer: Buffer

    try {
      nonceBuffer = Buffer.from(input.nonce, 'base64')
      ciphertextBuffer = Buffer.from(input.ciphertext, 'base64')

      // Verify the decoded data can be re-encoded to the same string
      // This catches edge cases where Buffer.from accepts invalid base64
      if (
        nonceBuffer.toString('base64') !== input.nonce ||
        ciphertextBuffer.toString('base64') !== input.ciphertext
      ) {
        throw new Error('Invalid base64')
      }
    } catch (e) {
      const error = new Error('Invalid base64 encoding')
      error.name = 'ValidationError'
      throw error
    }

    // Calculate actual size
    const actualSize = ciphertextBuffer.length

    // Check max size
    if (actualSize > config.manifest.maxSize) {
      const error = new Error('Manifest exceeds maximum size')
      error.name = 'PayloadTooLargeError'
      throw error
    }

    // Find or create vault
    let vault = await vaultRepository.findVaultByUserId(userId)
    let isNewVault = false

    if (!vault) {
      // Create vault lazily
      const vaultId = `vlt_${nanoid(21)}`
      const now = Date.now()
      vault = await vaultRepository.createVault({
        vaultId,
        userId,
        version: 0,
        bytesTotal: 0,
        updatedAt: now
      })
      isNewVault = true
      console.log(`Vault created for user: ${userId}`)
    }

    // Get current manifest (if exists)
    const currentManifest = await vaultRepository.getManifestByVaultId(
      vault.vaultId
    )
    const currentVersion = vault.version
    const isFirstWrite = currentVersion === 0

    // Validate version sequencing
    if (input.version !== currentVersion + 1) {
      const error = new Error('Version conflict: version must be current + 1')
      error.name = 'ConflictError'
      throw error
    }

    // Validate If-Match for updates (version > 1)
    if (input.version > 1) {
      if (!ifMatch) {
        const error = new Error('If-Match header required for updates')
        error.name = 'ConflictError'
        throw error
      }

      if (currentManifest && ifMatch !== currentManifest.etag) {
        const error = new Error('ETag mismatch')
        error.name = 'ConflictError'
        throw error
      }
    }

    // Compute new ETag
    const newEtag = computeEtag(
      vault.vaultId,
      input.version,
      nonceBuffer,
      ciphertextBuffer
    )

    // Current timestamp
    const now = Date.now()

    // Upsert manifest
    await vaultRepository.upsertManifest(vault.vaultId, {
      etag: newEtag,
      version: input.version,
      nonce: nonceBuffer,
      ciphertext: ciphertextBuffer,
      size: actualSize,
      updatedAt: now
    })

    // Update vault metadata
    await vaultRepository.updateVault(vault.vaultId, {
      version: input.version,
      bytesTotal: actualSize,
      updatedAt: now
    })

    console.log(
      `Manifest ${isFirstWrite ? 'created' : 'updated'} for vault: ${vault.vaultId}, version: ${input.version}`
    )

    return {
      output: {
        vault_id: vault.vaultId,
        version: input.version,
        etag: newEtag,
        updated_at: now
      },
      isNew: isFirstWrite
    }
  } catch (error) {
    // Re-throw known errors
    if (error instanceof Error) {
      if (
        ['ValidationError', 'ConflictError', 'PayloadTooLargeError'].includes(
          error.name
        )
      ) {
        throw error
      }
    }

    // Log error without sensitive data
    console.error(
      'Upsert manifest failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw new Error('Failed to save manifest')
  }
}
