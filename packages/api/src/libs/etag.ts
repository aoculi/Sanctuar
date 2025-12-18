// ETag computation utilities using SHA-256
import { sha256 } from '@noble/hashes/sha2.js'

/**
 * Compute base64url-encoded SHA-256 hash for ETag
 * @param data - Data to hash (vault_id || version || nonce || ciphertext)
 * @returns Base64url-encoded hash
 */
export function computeEtag(
  vaultId: string,
  version: number,
  nonce: Buffer,
  ciphertext: Buffer
): string {
  // Concatenate: vault_id || version || nonce || ciphertext
  const vaultIdBytes = Buffer.from(vaultId, 'utf8')
  const versionBytes = Buffer.from(version.toString(), 'utf8')

  const combined = Buffer.concat([
    vaultIdBytes,
    versionBytes,
    nonce,
    ciphertext
  ])

  // Compute SHA-256 hash
  const hash = sha256(combined)

  // Convert to base64url (RFC 4648)
  return Buffer.from(hash)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
