import type { Bookmark, Tag } from '@/lib/types'
import { getHostname } from '@/lib/utils'

/**
 * Create a memoized tag lookup map for O(1) tag name lookups
 * @param tags - Array of tags
 * @returns Map from tag ID to tag name
 */
export function createTagMap(tags: Tag[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const tag of tags) {
    map.set(tag.id, tag.name)
  }
  return map
}

/**
 * Get tag name by ID using a tag map for O(1) lookup
 * @param tagId - Tag ID to look up
 * @param tagMap - Map of tag ID to tag name
 * @returns Tag name or tag ID if not found
 */
export function getTagNameFromMap(
  tagId: string,
  tagMap: Map<string, string>
): string {
  return tagMap.get(tagId) || tagId
}

/**
 * Get tag name by ID (legacy function, uses linear search)
 * @deprecated Use getTagNameFromMap with createTagMap for better performance
 */
export function getTagName(tagId: string, tags: Tag[]): string {
  return tags.find((t) => t.id === tagId)?.name || tagId
}

/**
 * Tokenize search query and filter bookmarks
 * Uses optimized tag lookup for better performance
 */
export function filterBookmarks(
  bookmarks: Bookmark[],
  tags: Tag[],
  query: string
): Bookmark[] {
  const searchTokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0)

  if (searchTokens.length === 0) {
    return bookmarks
  }

  // Create tag map once for O(1) lookups
  const tagMap = createTagMap(tags)

  return bookmarks.filter((bookmark) => {
    const hostname = getHostname(bookmark.url).toLowerCase()
    const titleLower = bookmark.title.toLowerCase()
    const noteLower = (bookmark.note || '').toLowerCase()

    // Use optimized tag lookup
    const tagNames = bookmark.tags
      .map((tagId) => getTagNameFromMap(tagId, tagMap).toLowerCase())
      .join(' ')

    const urlLower = bookmark.url.toLowerCase()

    // All tokens must match at least one field
    return searchTokens.every((token) => {
      return (
        titleLower.includes(token) ||
        hostname.includes(token) ||
        tagNames.includes(token) ||
        urlLower.includes(token) ||
        noteLower.includes(token)
      )
    })
  })
}

/**
 * Calculate the relative luminance of a color (WCAG formula)
 * @param hex - Hex color string (e.g., "#ff0000" or "ff0000")
 * @returns Relative luminance value between 0 and 1
 */
function getLuminance(hex: string): number {
  // Remove # if present
  const cleanHex = hex.replace('#', '')

  // Parse RGB values
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255

  // Apply gamma correction
  const [rLinear, gLinear, bLinear] = [r, g, b].map((val) => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  })

  // Calculate relative luminance using WCAG formula
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear
}

/**
 * Get the best text color (black or white) for a given background color
 * @param backgroundColor - Hex color string
 * @returns "#000000" for light backgrounds, "#ffffff" for dark backgrounds
 */
function getContrastTextColor(backgroundColor: string): string {
  const luminance = getLuminance(backgroundColor)
  // Use black text on light backgrounds (luminance > 0.5), white on dark
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

export type TagColorInfo = {
  tagColor: string
  textColor: string
}

/**
 * Get tag color information including optimal text color for readability
 * @param tagId - Tag ID to look up
 * @param tags - Array of tags
 * @returns Object with tagColor and textColor, or null if tag not found or has no color
 */
export const getTagColor = (
  tagId: string,
  tags: Tag[]
): TagColorInfo | null => {
  const tag = tags.find((t: Tag) => t.id === tagId)
  if (!tag || !tag.color) return null

  const tagColor = tag.color
  const textColor = getContrastTextColor(tagColor)

  return {
    tagColor,
    textColor
  }
}

export type ProcessedBookmarks = {
  visibleBookmarks: Bookmark[]
  pinnedBookmarks: Bookmark[]
  nonPinnedBookmarks: Bookmark[]
}

/**
 * Process bookmarks by filtering and sorting them based on various criteria
 * @param bookmarks - Array of all bookmarks
 * @param tags - Array of all tags
 * @param options - Processing options
 * @returns Object containing visible, pinned, and non-pinned bookmarks
 */
export function processBookmarks(
  bookmarks: Bookmark[],
  tags: Tag[],
  options: {
    searchQuery: string
    selectedTags: string[]
    sortMode: 'updated_at' | 'title'
    showHiddenTags: boolean
    currentTagId?: string | null
  }
): ProcessedBookmarks {
  const { searchQuery, selectedTags, sortMode, showHiddenTags, currentTagId } =
    options

  // Create a set of hidden tag IDs for efficient lookup
  const hiddenTagIds = new Set(
    tags.filter((tag) => tag.hidden).map((tag) => tag.id)
  )

  // Bookmarks that should be visible given the hidden tag setting
  const visibleBookmarks = showHiddenTags
    ? bookmarks
    : bookmarks.filter(
        (bookmark) => !bookmark.tags.some((tagId) => hiddenTagIds.has(tagId))
      )

  // Filter bookmarks based on search and selected tags
  let filtered = filterBookmarks(visibleBookmarks, tags, searchQuery)

  // Filter by selected tags (if any are selected)
  if (selectedTags.length > 0) {
    // Special handling for 'unsorted' tag - show only bookmarks without tags
    if (selectedTags.includes('unsorted')) {
      filtered = filtered.filter((bookmark) => bookmark.tags.length === 0)
    } else {
      filtered = filtered.filter((bookmark) =>
        selectedTags.some((tagId) => bookmark.tags.includes(tagId))
      )
    }
  } else if (currentTagId && currentTagId !== 'all') {
    // Fallback to legacy currentTagId filtering if no selectedTags
    if (currentTagId === 'unsorted') {
      filtered = filtered.filter((bookmark) => bookmark.tags.length === 0)
    } else {
      filtered = filtered.filter((bookmark) =>
        bookmark.tags.includes(currentTagId)
      )
    }
  }

  // Separate pinned and non-pinned bookmarks
  const pinned: Bookmark[] = []
  const nonPinned: Bookmark[] = []

  filtered.forEach((bookmark) => {
    if (bookmark.pinned) {
      pinned.push(bookmark)
    } else {
      nonPinned.push(bookmark)
    }
  })

  // Sort pinned bookmarks
  if (sortMode === 'title') {
    pinned.sort((a, b) => a.title.localeCompare(b.title))
  } else {
    pinned.sort((a, b) => b.updated_at - a.updated_at)
  }

  // Sort non-pinned bookmarks
  if (sortMode === 'title') {
    nonPinned.sort((a, b) => a.title.localeCompare(b.title))
  } else {
    nonPinned.sort((a, b) => b.updated_at - a.updated_at)
  }

  return {
    visibleBookmarks,
    pinnedBookmarks: pinned,
    nonPinnedBookmarks: nonPinned
  }
}
