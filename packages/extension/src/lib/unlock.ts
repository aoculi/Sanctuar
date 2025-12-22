/**
 * Unlock utilities for vault decryption
 *
 * This module handles the unlock flow:
 * - Derives keys from password using KDF
 * - Stores MAK and aadContext in chrome.storage for manifest decryption
 * - Provides zeroize functionality to clear sensitive data
 */

import type { KdfParams } from '@/api/auth-api'
import { apiClient, createApiError, type ApiError } from '@/lib/api'
import { AAD_LABELS, constructAadWmk, STORAGE_KEYS } from '@/lib/constants'
import {
  base64ToUint8Array,
  zeroize as cryptoZeroize,
  decryptAEAD,
  deriveKeyFromPassword,
  deriveSubKeys,
  encryptAEAD,
  uint8ArrayToBase64
} from '@/lib/crypto'
import { whenCryptoReady } from '@/lib/cryptoEnv'
import { setStorageItem } from '@/lib/storage'

/**
 * AAD context for authenticated encryption
 */
export type AadContext = {
  userId: string
  vaultId: string
  wmkLabel: string
  manifestLabel: string
}

/**
 * Keystore data stored in chrome.storage
 */
export type KeystoreData = {
  mak: string // base64-encoded MAK
  aadContext: AadContext
}

/**
 * Input for unlock operation
 */
export type UnlockInput = {
  password: string
  userId: string
  vaultId: string
  kdf: KdfParams
  wrappedMk: string | null
}

/**
 * Result of unlock operation
 */
export type UnlockResult = {
  success: boolean
  isFirstUnlock: boolean
}

/**
 * Performs the unlock flow:
 * 1. Derives UEK from password using KDF
 * 2. Unwraps or generates MK (Master Key)
 * 3. Derives operational keys (KEK, MAK)
 * 4. Stores MAK and aadContext in chrome.storage
 * 5. Zeroizes all intermediate keys
 *
 * @param input - Unlock parameters (password, userId, vaultId, kdf, wrappedMk)
 * @returns UnlockResult with success status and isFirstUnlock flag
 * @throws Error if unlock fails
 */
export async function unlock(input: UnlockInput): Promise<UnlockResult> {
  const { password, userId, vaultId, kdf, wrappedMk } = input

  // Precondition: sodium ready
  await whenCryptoReady()

  // Derive UEK (User Encryption Key) from password
  const kdfSalt = base64ToUint8Array(kdf.salt)
  const uek = await deriveKeyFromPassword(password, kdfSalt)

  let mk: Uint8Array
  let isFirstUnlock = false

  try {
    if (wrappedMk) {
      // Case 1: wrapped_mk is present - decrypt MK
      try {
        const wmkData = base64ToUint8Array(wrappedMk)
        const nonce = wmkData.subarray(0, 24)
        const ciphertext = wmkData.subarray(24)

        const aadWmk = new TextEncoder().encode(
          constructAadWmk(userId, vaultId)
        )
        mk = decryptAEAD(ciphertext, nonce, uek, aadWmk)

        // Zeroize UEK immediately after decrypting MK
        cryptoZeroize(uek)
      } catch {
        cryptoZeroize(uek)
        throw new Error('Unable to unlock')
      }
    } else {
      // Case 2: wrapped_mk is null (first unlock ever)
      isFirstUnlock = true

      // Generate MK = RNG(32B)
      const sodium = (await import('libsodium-wrappers-sumo')).default
      await sodium.ready
      mk = sodium.randombytes_buf(32)

      // Wrap it: WMK = AEAD_UEK_ENC(MK, AAD_WMK, nonce=RNG(24B))
      const aadWmk = new TextEncoder().encode(constructAadWmk(userId, vaultId))
      const { nonce, ciphertext } = encryptAEAD(mk, uek, aadWmk)

      // Zeroize UEK immediately after creating MK
      cryptoZeroize(uek)

      // Create WMK format: nonce(24B) || ciphertext
      const wmk = new Uint8Array(24 + ciphertext.length)
      wmk.set(nonce, 0)
      wmk.set(ciphertext, 24)
      const wmkBase64 = uint8ArrayToBase64(wmk)

      // POST /user/wmk with the chosen WMK format
      try {
        const response = await apiClient<{ ok: boolean }>('/user/wmk', {
          method: 'POST',
          body: { wrapped_mk: wmkBase64 }
        })

        if (!response.data?.ok) {
          throw new Error('Could not initialize vault')
        }
      } catch (error: unknown) {
        const apiError = error as ApiError
        const status = apiError.status || 500
        throw createApiError(status, 'Could not initialize vault', {
          wmkUploadFailed: true,
          isFirstUnlock: true
        })
      }
    }

    // Derive operational keys using HKDF
    const hkdfSalt = kdf.hkdf_salt ? base64ToUint8Array(kdf.hkdf_salt) : kdfSalt // Fallback for backwards compatibility
    const { kek, mak } = deriveSubKeys(mk, hkdfSalt)

    // Build AAD context
    const aadContext: AadContext = {
      userId,
      vaultId,
      wmkLabel: AAD_LABELS.wmk,
      manifestLabel: AAD_LABELS.manifest
    }

    // Store MAK and aadContext in chrome.storage
    const keystoreData: KeystoreData = {
      mak: uint8ArrayToBase64(mak),
      aadContext
    }
    await setStorageItem(STORAGE_KEYS.KEYSTORE, keystoreData)

    // Zeroize local temporaries (MK, KEK, MAK)
    cryptoZeroize(mk, kek, mak)

    return {
      success: true,
      isFirstUnlock
    }
  } catch (error) {
    cryptoZeroize(uek)
    throw error
  }
}
