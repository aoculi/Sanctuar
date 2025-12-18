// User service - handles user profile and encrypted data management
import * as userRepository from '../repositories/user.repository'

export interface UploadWmkInput {
  userId: string
  wrappedMk: string
  label?: string
}

/**
 * Upload Wrapped Master Key (WMK)
 * - Decodes base64 wrapped master key
 * - Extracts nonce and ciphertext
 * - Stores in database for the user
 * @throws Error if upload fails
 */
export const uploadWrappedMasterKey = async (
  input: UploadWmkInput
): Promise<void> => {
  const { userId, wrappedMk, label } = input

  try {
    // Decode base64 wrapped master key
    const wmkBuffer = Buffer.from(wrappedMk, 'base64')

    // WMK format: nonce (24 bytes) + ciphertext (variable)
    // XChaCha20-Poly1305 uses 24-byte nonce
    const nonceLength = 24

    if (wmkBuffer.length < nonceLength + 16) {
      // Minimum: 24 bytes nonce + 16 bytes (empty plaintext + 16 bytes auth tag)
      throw new Error('Invalid wrapped master key format')
    }

    // Extract nonce and ciphertext
    const wmkNonce = wmkBuffer.subarray(0, nonceLength)
    const wmkCiphertext = wmkBuffer.subarray(nonceLength)

    // Update user's wrapped master key
    await userRepository.updateUserWmk(userId, {
      wmkNonce,
      wmkCiphertext,
      wmkLabel: label || 'wmk_v1'
    })

    console.log(`Wrapped master key uploaded for user: ${userId}`)
  } catch (error) {
    // Log error without sensitive data
    console.error(
      'WMK upload failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )

    if (
      error instanceof Error &&
      error.message === 'Invalid wrapped master key format'
    ) {
      throw error
    }

    throw new Error('Failed to upload wrapped master key')
  }
}
