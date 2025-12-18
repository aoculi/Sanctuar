// Vault repository - handles all database operations for vaults
import { eq } from 'drizzle-orm'
import { db } from '../database/db'
import { manifests, NewVault, vaults } from '../database/schema'

/**
 * Find a vault by vault ID
 * @param vaultId - The vault ID to search for
 * @returns Vault record or undefined if not found
 */
export async function findVaultById(vaultId: string) {
  const result = await db
    .select()
    .from(vaults)
    .where(eq(vaults.vaultId, vaultId))
    .limit(1)

  return result[0]
}

/**
 * Find a vault by user ID
 * @param userId - The user ID to search for
 * @returns Vault record or undefined if not found
 */
export async function findVaultByUserId(userId: string) {
  const result = await db
    .select()
    .from(vaults)
    .where(eq(vaults.userId, userId))
    .limit(1)

  return result[0]
}

/**
 * Create a new vault for a user
 * @param vaultData - Vault data to insert
 * @returns The created vault record
 */
export async function createVault(vaultData: NewVault) {
  await db.insert(vaults).values(vaultData)

  // Fetch and return the created vault
  return findVaultById(vaultData.vaultId)
}

/**
 * Update vault metadata
 * @param vaultId - The vault ID to update
 * @param data - Data to update (version, bytesTotal, etc.)
 * @returns The updated vault record
 */
export async function updateVault(
  vaultId: string,
  data: {
    version?: number
    bytesTotal?: number
    updatedAt?: number
  }
) {
  await db.update(vaults).set(data).where(eq(vaults.vaultId, vaultId))

  return findVaultById(vaultId)
}

/**
 * Check if a manifest exists for a vault
 * @param vaultId - The vault ID to check
 * @returns True if manifest exists, false otherwise
 */
export async function manifestExists(vaultId: string): Promise<boolean> {
  const result = await db
    .select({ vaultId: manifests.vaultId })
    .from(manifests)
    .where(eq(manifests.vaultId, vaultId))
    .limit(1)

  return result.length > 0
}

/**
 * Get manifest by vault ID
 * @param vaultId - The vault ID to search for
 * @returns Manifest record or undefined if not found
 */
export async function getManifestByVaultId(vaultId: string) {
  const result = await db
    .select()
    .from(manifests)
    .where(eq(manifests.vaultId, vaultId))
    .limit(1)

  return result[0]
}

/**
 * Upsert manifest (create or update)
 * @param vaultId - The vault ID
 * @param manifestData - Manifest data to insert/update
 */
export async function upsertManifest(
  vaultId: string,
  manifestData: {
    etag: string
    version: number
    nonce: Buffer
    ciphertext: Buffer
    size: number
    updatedAt: number
  }
) {
  // Check if manifest exists
  const existing = await getManifestByVaultId(vaultId)

  if (existing) {
    // Update existing manifest
    await db
      .update(manifests)
      .set({
        etag: manifestData.etag,
        version: manifestData.version,
        nonce: manifestData.nonce,
        ciphertext: manifestData.ciphertext,
        size: manifestData.size,
        updatedAt: manifestData.updatedAt
      })
      .where(eq(manifests.vaultId, vaultId))
  } else {
    // Insert new manifest
    await db.insert(manifests).values({
      vaultId,
      ...manifestData
    })
  }

  return getManifestByVaultId(vaultId)
}
