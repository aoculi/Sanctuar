/**
 * Crypto environment initialization
 * Ensures libsodium is ready before any crypto operations
 */

import sodium from 'libsodium-wrappers-sumo'
import type { CryptoEnv } from './types'

let cryptoEnv: CryptoEnv = {
  ready: false,
  sodium: null
}

let readyPromise: Promise<void> | null = null

/**
 * Initialize the crypto environment
 * Must be called before any crypto operations
 */
export async function initCrypto(): Promise<void> {
  if (readyPromise) {
    return readyPromise
  }

  readyPromise = (async () => {
    await sodium.ready
    cryptoEnv.ready = true
    cryptoEnv.sodium = sodium
  })()

  return readyPromise
}

/**
 * Get the crypto environment
 * Throws if not initialized
 */
export function getCryptoEnv(): typeof sodium {
  if (!cryptoEnv.ready || !cryptoEnv.sodium) {
    throw new Error(
      'Crypto environment not initialized. Call initCrypto() first.'
    )
  }
  return cryptoEnv.sodium
}

/**
 * Resolve once the crypto environment is ready.
 * Prefer this over manual ready checks to keep initialization consistent.
 */
export function whenCryptoReady(): Promise<void> {
  if (cryptoEnv.ready) {
    return Promise.resolve()
  }
  return initCrypto()
}
