/**
 * Hardcoded security constants for the vault system (Milestone 1)
 * Based on Proton-level security with libsodium and HKDF
 */

/**
 * Format Documentation
 *
 * ============================================================================
 * KDF FOR UEK (User Encryption Key)
 * ============================================================================
 * Algorithm: Argon2id
 * Parameters:
 *   - salt: Provided by server in kdf.salt (base64 encoded, 32 bytes when decoded)
 *   - m: Memory cost parameter from server (kdf.m)
 *   - t: Time cost parameter from server (kdf.t)
 *   - p: Parallelism parameter from server (kdf.p)
 * Output: UEK (32 bytes)
 *
 * Usage: Derive UEK from password using server-provided KDF parameters
 *
 * ============================================================================
 * WMK (Wrapped Master Key) Format
 * ============================================================================
 * Format: Single base64 string
 * Structure: nonce(24B) || ciphertext (AEAD tag included at end)
 *
 * Decoding:
 *   1. Decode base64 to get binary data
 *   2. Extract nonce: first 24 bytes
 *   3. Extract ciphertext: remaining bytes (includes AEAD authentication tag)
 *
 * Encryption Details:
 *   - Algorithm: XChaCha20-Poly1305 (AEAD)
 *   - Key: UEK (32 bytes)
 *   - Nonce: 24 bytes (random, included in WMK)
 *   - AAD: See AAD_WMK format below
 *
 * ============================================================================
 * AAD (Additional Authenticated Data) Labels
 * ============================================================================
 * Format: UTF-8 encoded string
 *
 * AAD_WMK (for Wrapped Master Key):
 *   Format: user_id + "|" + vault_id + "|wmk_v1"
 *   Example: "user123|vault456|wmk_v1"
 *   Important: This string must be constant and versioned. Keep version in label.
 *
 * AAD_MANIFEST (for Manifest):
 *   Format: user_id + "|" + vault_id + "|manifest_v1"
 *   Example: "user123|vault456|manifest_v1"
 *   Important: This string must match when encrypting and decrypting.
 *
 * Note: Always use the exact format above. The separator is "|" (pipe character).
 *       Version labels (wmk_v1, manifest_v1) should be updated when format changes.
 */

export const KDF = {
  algo: 'argon2id' as const,
  opslimit: 'MODERATE' as const,
  memlimit: 'MODERATE' as const,
  outLen: 32, // bytes
  saltLen: 32 // bytes
}

export const HKDF = {
  saltLen: 16, // bytes - separate salt for HKDF
  keyLen: 32 // bytes - output key length
}

export const AEAD = {
  algo: 'xchacha20poly1305' as const,
  nonceLen: 24 // bytes
}

export const AAD_LABELS = {
  manifest: 'manifest_v1' as const,
  wmk: 'wmk_v1' as const
}

/**
 * Construct AAD string for WMK (Wrapped Master Key)
 * Format: user_id + "|" + vault_id + "|wmk_v1"
 */
export function constructAadWmk(userId: string, vaultId: string): string {
  return `${userId}|${vaultId}|wmk_v1`
}

/**
 * Construct AAD string for Manifest
 * Format: user_id + "|" + vault_id + "|manifest_v1"
 */
export function constructAadManifest(userId: string, vaultId: string): string {
  return `${userId}|${vaultId}|manifest_v1`
}

export const KEY_DERIVATION = {
  kek_info: 'VAULT/KEK v1',
  mak_info: 'VAULT/MAK v1'
}

// Storage keys for chrome.storage.local
export const STORAGE_KEYS = {
  SETTINGS: 'settings',
  SESSION: 'session',
  KEYSTORE: 'keystore',
  MANIFEST: 'manifest',
  PIN_STORE: 'pin_store',
  LOCK_STATE: 'lock_state',
  IS_SOFT_LOCKED: 'is_locked', // Soft lock flag - vault locked but can unlock with PIN (vs hard lock requiring password)
  API_URL: 'api_url' // Global API URL setting (not user-specific)
} as const

// Auto-lock timer constants
export const DEFAULT_AUTO_LOCK_TIMEOUT = '20min'
export const DEFAULT_AUTO_LOCK_TIMEOUT_MS = 20 * 60 * 1000 // 20 minutes in milliseconds

// Token refresh constants
export const MIN_REFRESH_INTERVAL = 60 * 1000 * 2 // Minimum 2 minute between refresh attempts
