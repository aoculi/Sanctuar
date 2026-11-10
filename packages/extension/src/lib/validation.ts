/**
 * Validation constants and functions
 */
export const MAX_TAGS_PER_ITEM = 15
export const MAX_TAG_NAME_LENGTH = 32
export const MAX_COLLECTION_NAME_LENGTH = 50
export const MAX_DESCRIPTION_LENGTH = 300
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
 * Collection name validation
 */
export function validateCollectionName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) {
    return 'Collection name is required'
  }
  if (trimmed.length > MAX_COLLECTION_NAME_LENGTH) {
    return `Collection name cannot exceed ${MAX_COLLECTION_NAME_LENGTH} characters`
  }
  return null
}

/**
 * Clean up a page description for storage: collapse whitespace and cut it
 * to MAX_DESCRIPTION_LENGTH characters (with an ellipsis when cut).
 */
export function normalizeDescription(value: string | null | undefined): string {
  const text = (value ?? '').replace(/\s+/g, ' ').trim()
  if (text.length <= MAX_DESCRIPTION_LENGTH) return text
  return text.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd() + '…'
}
