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
        urlLower.includes(token)
      )
    })
  })
}
