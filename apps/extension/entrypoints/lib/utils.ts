/**
 * General utilities
 */
import { nanoid } from 'nanoid'

/**
 * Format date from timestamp with locale support
 * @param timestamp - Unix timestamp in milliseconds
 * @param options - Intl.DateTimeFormatOptions for custom formatting
 * @returns Formatted date string
 */
export function formatDate(
  timestamp: number,
  options?: Intl.DateTimeFormatOptions
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }
  return new Date(timestamp).toLocaleDateString(
    undefined,
    options || defaultOptions
  )
}

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
 * Generate a unique ID for bookmarks and tags
 * Uses nanoid for collision-resistant IDs
 * @returns Unique identifier string
 */
export function generateId(): string {
  return nanoid()
}
