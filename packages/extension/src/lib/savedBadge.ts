/**
 * "Already saved" toolbar badge.
 *
 * The background never sees the decrypted vault. Pages that hold the unlocked
 * manifest (popup, app) send it SHA-256 hashes of the normalized bookmark
 * URLs; the background keeps them in memory only and compares the active
 * tab's hashed URL against that set. The set is dropped on lock and logout.
 */
import { normalizeUrl } from '@/lib/utils'

export type SavedUrlsMessage =
  | { type: 'SAVED_URLS_UPDATE'; hashes: string[] }
  | { type: 'SAVED_URLS_CLEAR' }

export function isSavedUrlsMessage(message: unknown): message is SavedUrlsMessage {
  const type = (message as { type?: unknown } | null)?.type
  return type === 'SAVED_URLS_UPDATE' || type === 'SAVED_URLS_CLEAR'
}

/** SHA-256 hex of the normalized URL */
export async function hashUrl(url: string): Promise<string> {
  const data = new TextEncoder().encode(normalizeUrl(url))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('')
}

export async function hashUrls(urls: string[]): Promise<string[]> {
  return Promise.all(urls.map(hashUrl))
}

/** Send the current set (or null to clear it) to the background */
export function sendSavedUrls(hashes: string[] | null): void {
  const message: SavedUrlsMessage = hashes
    ? { type: 'SAVED_URLS_UPDATE', hashes }
    : { type: 'SAVED_URLS_CLEAR' }
  try {
    chrome.runtime.sendMessage(message, () => {
      // Read lastError so a missing receiver doesn't log an unchecked error
      void chrome.runtime.lastError
    })
  } catch {
    // Extension context gone (e.g. popup closing): nothing to do
  }
}
