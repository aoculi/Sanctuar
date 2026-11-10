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

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'gbraid',
  'wbraid',
  'msclkid',
  'yclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  '_hsenc',
  '_hsmi',
  'ref_src',
  'si'
])

/**
 * Canonical form of a URL used to spot duplicates: same page even if the
 * link differs by http/https, "www.", a trailing slash, the #fragment or
 * tracking parameters (utm_*, fbclid…). Hash routes (#/ or #!) are kept
 * because single-page apps use them as real paths.
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return trimmed.toLowerCase()
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    const port = parsed.port ? `:${parsed.port}` : ''
    const path = parsed.pathname.replace(/\/+$/, '')
    const params = [...parsed.searchParams.entries()]
      .filter(([key]) => {
        const k = key.toLowerCase()
        return !k.startsWith('utm_') && !TRACKING_PARAMS.has(k)
      })
      .sort(([a], [b]) => a.localeCompare(b))
    const query = params.length
      ? `?${new URLSearchParams(params).toString()}`
      : ''
    const hash =
      parsed.hash.startsWith('#/') || parsed.hash.startsWith('#!')
        ? parsed.hash
        : ''
    return `${host}${port}${path}${query}${hash}`
  } catch {
    return trimmed.toLowerCase()
  }
}

/**
 * "3 weeks ago", "yesterday"… for a past epoch-ms timestamp
 */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const seconds = Math.round((timestamp - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60]
  ]
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return rtf.format(Math.round(seconds / size), unit)
    }
  }
  return rtf.format(0, 'second')
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
