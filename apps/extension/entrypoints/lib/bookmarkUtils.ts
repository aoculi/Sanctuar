/**
 * Bookmark-specific utilities
 */
import { getHostname } from "./formatUtils";
import type { Bookmark, Tag } from "./types";

/**
 * Get tag name by ID
 */
export function getTagName(tagId: string, tags: Tag[]): string {
  return tags.find((t) => t.id === tagId)?.name || tagId;
}

/**
 * Tokenize search query and filter bookmarks
 */
export function filterBookmarks(
  bookmarks: Bookmark[],
  tags: Tag[],
  query: string
): Bookmark[] {
  const searchTokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);

  if (searchTokens.length === 0) {
    return bookmarks;
  }

  return bookmarks.filter((bookmark) => {
    const hostname = getHostname(bookmark.url).toLowerCase();
    const titleLower = bookmark.title.toLowerCase();
    const tagNames = bookmark.tags
      .map((tagId) => getTagName(tagId, tags).toLowerCase())
      .join(" ");

    // All tokens must match at least one field
    return searchTokens.every((token) => {
      return (
        titleLower.includes(token) ||
        hostname.includes(token) ||
        tagNames.includes(token) ||
        bookmark.url.toLowerCase().includes(token)
      );
    });
  });
}
