/**
 * Format KDF parameters for client response
 */
export function formatKdfParams(user: {
  kdfAlgo: string
  kdfSalt: Buffer
  kdfM: number
  kdfT: number
  kdfP: number
  hkdfSalt: Buffer | null
}) {
  return {
    algo: user.kdfAlgo,
    salt: user.kdfSalt.toString('base64'),
    m: user.kdfM,
    t: user.kdfT,
    p: user.kdfP,
    hkdf_salt: user.hkdfSalt ? user.hkdfSalt.toString('base64') : null
  }
}

/**
 * Format wrapped master key from user data
 * Returns null if WMK doesn't exist
 */
export function formatWrappedMk(user: {
  wmkCiphertext: Buffer | null
  wmkNonce: Buffer | null
}): string | null {
  if (!user.wmkCiphertext || !user.wmkNonce) {
    return null
  }

  // Combine nonce + ciphertext as base64
  const combined = Buffer.concat([user.wmkNonce, user.wmkCiphertext])
  return combined.toString('base64')
}
