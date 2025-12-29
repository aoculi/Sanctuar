/**
 * Validation constants and functions
 */
export const MAX_TAGS_PER_ITEM = 15
export const MAX_TAG_NAME_LENGTH = 32
export const MANIFEST_SIZE_WARNING_THRESHOLD = 4 * 1024 * 1024 // 4MB (warn before 5MB limit)

/**
 * URL validation - allows http, https, javascript, and other common bookmark protocols
 * JavaScript URLs (bookmarklets) and other protocols are valid bookmarks
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Allow common bookmark protocols
    const allowedProtocols = [
      'http:',
      'https:',
      'javascript:',
      'file:',
      'data:',
      'about:'
    ]
    return allowedProtocols.includes(parsed.protocol)
  } catch {
    // If URL parsing fails, it's not a valid URL
    return false
  }
}

/**
 * Bookmark input validation
 */
export function validateBookmarkInput(data: {
  url: string
  title: string
  note: string
  picture: string
  tags: string[]
}): string | null {
  if (!data.url.trim()) {
    return 'URL is required'
  }

  const trimmedUrl = data.url.trim()
  if (!isValidUrl(trimmedUrl)) {
    return 'Please enter a valid URL (http://, https://, javascript:, etc.)'
  }

  if (!data.title.trim()) {
    return 'Title is required'
  }

  if (data.tags.length > MAX_TAGS_PER_ITEM) {
    return `Maximum ${MAX_TAGS_PER_ITEM} tags per bookmark`
  }

  return null
}

/**
 * Tag name validation
 */
export function validateTagName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) {
    return 'Tag name is required'
  }
  if (trimmed.length > MAX_TAG_NAME_LENGTH) {
    return `Tag name cannot exceed ${MAX_TAG_NAME_LENGTH} characters`
  }
  return null
}

/**
 * Manifest size estimation and warning
 */
export function estimateManifestSize(manifest: {
  version: number
  items: unknown[]
  tags?: unknown[]
  chain_head?: string
}): number {
  try {
    return new TextEncoder().encode(JSON.stringify(manifest)).length
  } catch {
    return 0
  }
}

export function isManifestSizeWarning(size: number): boolean {
  return size >= MANIFEST_SIZE_WARNING_THRESHOLD
}
