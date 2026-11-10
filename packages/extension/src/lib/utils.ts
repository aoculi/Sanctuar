/**
 * General utilities
 */
import { nanoid } from 'nanoid'

/**
 * Get hostname from URL
 * @param url - Full URL string
 * @returns Hostname or original URL if parsing fails
 */
export function getHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/**
 * Favicon for a bookmark without asking a third party.
 * Uses the stored icon (captured from the tab) when there is one, otherwise
 * the site's own /favicon.ico. Never a favicon service such as Google's,
 * which would learn every domain the user has bookmarked.
 */
export function getFaviconUrl(url: string, picture?: string): string | null {
  if (picture?.trim()) return picture.trim()
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return `${parsed.origin}/favicon.ico`
  } catch {
    return null
  }
}

/**
 * Generate a unique ID for bookmarks and tags
 * Uses nanoid for collision-resistant IDs
 * @returns Unique identifier string
 */
export function generateId(): string {
  return nanoid()
}
