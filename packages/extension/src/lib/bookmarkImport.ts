/**
 * Bookmark import functionality
 * Supports Chrome, Firefox, and Safari bookmark exports
 */

import type { Bookmark, Tag } from './types'
import { isValidUrl } from './validation'

export type BrowserType = 'chrome' | 'firefox' | 'safari' | 'auto'

export interface ParsedBookmark {
  url: string
  title: string
  folderPath: string[]
  addDate?: number
  lastModified?: number
}

export interface ImportResult {
  bookmarks: ParsedBookmark[]
  folders: string[]
  errors: string[]
}

/**
 * Detect browser type from file content or filename
 */
export function detectBrowserType(
  filename: string,
  content: string
): BrowserType {
  const lowerFilename = filename.toLowerCase()
  const trimmed = content.trim()

  // Check filename patterns
  if (lowerFilename.includes('chrome') || lowerFilename.includes('bookmarks')) {
    return 'chrome'
  }
  if (lowerFilename.includes('firefox') || lowerFilename.includes('places')) {
    return 'firefox'
  }
  if (lowerFilename.includes('safari')) {
    return 'safari'
  }

  // Check if it's JSON format
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const data = JSON.parse(trimmed)
      // Chrome JSON format has "version" and "roots" properties
      if (data.version && data.roots) {
        return 'chrome'
      }
    } catch {
      // Not valid JSON, continue with HTML detection
    }
  }

  // Check content patterns for HTML format
  if (content.includes('NETSCAPE-Bookmark-file-1')) {
    // Standard HTML bookmark format
    if (content.includes('HREF=')) {
      // Try to detect by specific markers
      if (
        content.includes('Personal Toolbar') ||
        content.includes('Bookmarks Toolbar')
      ) {
        return 'chrome'
      }
      if (
        content.includes('Mozilla Firefox') ||
        content.includes('places.sqlite')
      ) {
        return 'firefox'
      }
      if (content.includes('Safari') || content.includes('WebKit')) {
        return 'safari'
      }
    }
  }

  return 'auto'
}

/**
 * Chrome bookmark JSON structure types
 */
interface ChromeBookmarkNode {
  type: 'url' | 'folder'
  name: string
  url?: string
  date_added?: string
  date_modified?: string
  children?: ChromeBookmarkNode[]
}

interface ChromeBookmarkRoot {
  version: number
  roots: {
    bookmark_bar?: ChromeBookmarkNode
    other?: ChromeBookmarkNode
    synced?: ChromeBookmarkNode
  }
}

/**
 * Parse Chrome JSON bookmark file
 */
export function parseChromeJsonBookmarkFile(content: string): ImportResult {
  const bookmarks: ParsedBookmark[] = []
  const folders = new Set<string>()
  const errors: string[] = []

  try {
    const data: ChromeBookmarkRoot = JSON.parse(content)

    if (!data.roots) {
      errors.push('Invalid Chrome bookmark JSON format: missing roots')
      return { bookmarks, folders: [], errors }
    }

    // Helper to convert Chrome timestamp (microseconds since 1601-01-01) to milliseconds
    function chromeTimestampToMs(timestamp: string): number {
      // Chrome uses microseconds since 1601-01-01
      // Convert to milliseconds since 1970-01-01
      const chromeEpoch = Date.UTC(1601, 0, 1)
      const microseconds = parseInt(timestamp, 10)
      return chromeEpoch + Math.floor(microseconds / 1000)
    }

    // Recursive function to traverse bookmark tree
    function traverseNode(
      node: ChromeBookmarkNode,
      folderPath: string[] = []
    ): void {
      if (!node.type) {
        // Skip nodes without type
        return
      }

      if (node.type === 'url') {
        if (!node.url) {
          errors.push(`Bookmark missing URL: ${node.name || 'Unknown'}`)
          return
        }

        // Validate URL
        if (!isValidUrl(node.url)) {
          errors.push(`Invalid URL: ${node.url} (${node.name || 'Unknown'})`)
          return
        }

        // Add folders to set
        folderPath.forEach((folder) => {
          if (folder) folders.add(folder)
        })

        const addDate = node.date_added
          ? chromeTimestampToMs(node.date_added)
          : undefined
        const lastModified = node.date_modified
          ? chromeTimestampToMs(node.date_modified)
          : undefined

        bookmarks.push({
          url: node.url,
          title: node.name || 'Untitled',
          folderPath: [...folderPath].filter(Boolean),
          addDate,
          lastModified
        })
      } else if (node.type === 'folder') {
        const folderName = node.name || 'Untitled Folder'
        const newPath = [...folderPath, folderName]
        folders.add(folderName)

        // Traverse children
        if (node.children && Array.isArray(node.children)) {
          node.children.forEach((child) => traverseNode(child, newPath))
        }
      }
    }

    // Traverse all root folders
    if (data.roots.bookmark_bar) {
      traverseNode(data.roots.bookmark_bar, [])
    }
    if (data.roots.other) {
      traverseNode(data.roots.other, [])
    }
    if (data.roots.synced) {
      traverseNode(data.roots.synced, [])
    }
  } catch (error) {
    errors.push(
      `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  return {
    bookmarks,
    folders: Array.from(folders).sort(),
    errors
  }
}

/**
 * Parse HTML bookmark file (Netscape Bookmark File Format)
 * Used by Chrome, Firefox, and Safari
 */
export function parseHtmlBookmarkFile(content: string): ImportResult {
  const bookmarks: ParsedBookmark[] = []
  const folders = new Set<string>()
  const errors: string[] = []

  // Check if it's a valid bookmark file
  if (!content.includes('NETSCAPE-Bookmark-file-1')) {
    errors.push(
      'Invalid bookmark file format. Expected Netscape Bookmark File Format.'
    )
    return { bookmarks, folders: [], errors }
  }

  // Create a temporary DOM element to parse HTML
  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'text/html')

  // Helper function to extract folder path from a DT element
  function getFolderPath(element: Element): string[] {
    const path: string[] = []
    let current: Element | null = element

    while (current) {
      const h3 = current.querySelector('H3')
      if (h3 && h3.textContent) {
        path.unshift(h3.textContent.trim())
      }
      current = current.parentElement
      if (current && current.tagName === 'DL') {
        current = current.parentElement
      } else {
        break
      }
    }

    return path
  }

  // Find all bookmark links (A tags with HREF)
  const links = doc.querySelectorAll('A[HREF]')

  links.forEach((link) => {
    try {
      const href = link.getAttribute('HREF')
      const title = link.textContent?.trim() || 'Untitled'

      if (!href) {
        errors.push(`Bookmark missing URL: ${title}`)
        return
      }

      // Validate URL
      if (!isValidUrl(href)) {
        errors.push(`Invalid URL: ${href} (${title})`)
        return
      }

      // Extract dates
      const addDate = link.getAttribute('ADD_DATE')
      const lastModified = link.getAttribute('LAST_MODIFIED')

      // Get folder path
      const folderPath = getFolderPath(link)

      // Add folders to set
      folderPath.forEach((folder) => folders.add(folder))

      bookmarks.push({
        url: href,
        title,
        folderPath,
        addDate: addDate ? parseInt(addDate, 10) * 1000 : undefined, // Convert to milliseconds
        lastModified: lastModified
          ? parseInt(lastModified, 10) * 1000
          : undefined
      })
    } catch (error) {
      errors.push(
        `Error parsing bookmark: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  })

  // Also extract folder names from H3 tags (folders without bookmarks)
  const folderHeaders = doc.querySelectorAll('H3')
  folderHeaders.forEach((h3) => {
    const folderName = h3.textContent?.trim()
    if (folderName) {
      folders.add(folderName)
    }
  })

  return {
    bookmarks,
    folders: Array.from(folders).sort(),
    errors
  }
}

/**
 * Convert parsed bookmarks to Bookmark format
 */
export function convertToBookmarks(
  parsedBookmarks: ParsedBookmark[],
  createFolderTags: boolean,
  existingTags: Tag[]
): {
  bookmarks: Array<{
    bookmark: Omit<Bookmark, 'id' | 'created_at' | 'updated_at'>
    folderPath: string[]
  }>
  tagsToCreate: Omit<Tag, 'id'>[]
} {
  const bookmarks: Array<{
    bookmark: Omit<Bookmark, 'id' | 'created_at' | 'updated_at'>
    folderPath: string[]
  }> = []
  const tagsToCreate: Omit<Tag, 'id'>[] = []
  const tagNameToId = new Map<string, string>()

  // Map existing tags by name (case-insensitive)
  existingTags.forEach((tag) => {
    tagNameToId.set(tag.name.toLowerCase(), tag.id)
  })

  // Create tag mappings for folders if enabled
  if (createFolderTags) {
    const folderSet = new Set<string>()
    parsedBookmarks.forEach((bookmark) => {
      bookmark.folderPath.forEach((folder) => folderSet.add(folder))
    })

    folderSet.forEach((folderName) => {
      const lowerName = folderName.toLowerCase()
      if (!tagNameToId.has(lowerName)) {
        // Check if tag already exists in tagsToCreate
        const alreadyCreating = tagsToCreate.some(
          (t) => t.name.toLowerCase() === lowerName
        )
        if (!alreadyCreating) {
          tagsToCreate.push({
            name: folderName,
            hidden: false
          })
        }
      }
    })
  }

  // Convert parsed bookmarks
  parsedBookmarks.forEach((parsed) => {
    const tagIds: string[] = []

    if (createFolderTags) {
      parsed.folderPath.forEach((folder) => {
        const lowerName = folder.toLowerCase()
        const tagId = tagNameToId.get(lowerName)
        if (tagId) {
          tagIds.push(tagId)
        }
      })
    }

    bookmarks.push({
      bookmark: {
        url: parsed.url,
        title: parsed.title,
        note: '',
        picture: '',
        tags: tagIds
      },
      folderPath: parsed.folderPath
    })
  })

  return { bookmarks, tagsToCreate }
}

/**
 * Map folder paths to tag IDs after tags are created
 */
export function mapFolderPathsToTagIds(
  bookmarksWithPaths: Array<{
    bookmark: Omit<Bookmark, 'id' | 'created_at' | 'updated_at'>
    folderPath: string[]
  }>,
  tags: Tag[]
): Omit<Bookmark, 'id' | 'created_at' | 'updated_at'>[] {
  const tagNameToId = new Map<string, string>()
  tags.forEach((tag) => {
    tagNameToId.set(tag.name.toLowerCase(), tag.id)
  })

  return bookmarksWithPaths.map(({ bookmark, folderPath }) => {
    const tagIds: string[] = []
    folderPath.forEach((folder) => {
      const lowerName = folder.toLowerCase()
      const tagId = tagNameToId.get(lowerName)
      if (tagId) {
        tagIds.push(tagId)
      }
    })

    return {
      url: bookmark.url,
      title: bookmark.title,
      note: bookmark.note,
      picture: bookmark.picture,
      tags: tagIds
    }
  })
}

/**
 * Detect file format (HTML or JSON)
 */
function detectFileFormat(content: string): 'html' | 'json' | 'unknown' {
  const trimmed = content.trim()

  // Check if it's JSON (starts with { or [)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed)
      return 'json'
    } catch {
      // Not valid JSON, might be HTML
    }
  }

  // Check if it's HTML bookmark format
  if (
    trimmed.includes('NETSCAPE-Bookmark-file-1') ||
    trimmed.includes('<HTML>') ||
    trimmed.includes('<html>')
  ) {
    return 'html'
  }

  return 'unknown'
}

/**
 * Process uploaded bookmark file
 */
export async function processBookmarkFile(
  file: File,
  createFolderTags: boolean,
  existingTags: Tag[]
): Promise<{
  bookmarksWithPaths: Array<{
    bookmark: Omit<Bookmark, 'id' | 'created_at' | 'updated_at'>
    folderPath: string[]
  }>
  tagsToCreate: Omit<Tag, 'id'>[]
  errors: string[]
  browserType: BrowserType
}> {
  const errors: string[] = []

  try {
    // Read file content
    const content = await file.text()

    // Detect file format
    const format = detectFileFormat(content)

    if (format === 'unknown') {
      errors.push('Unknown file format. Expected HTML or JSON bookmark file.')
      return {
        bookmarksWithPaths: [],
        tagsToCreate: [],
        errors,
        browserType: 'auto'
      }
    }

    // Detect browser type
    const browserType = detectBrowserType(file.name, content)

    // Parse the file based on format
    let parseResult: ImportResult

    if (format === 'json') {
      // Try Chrome JSON format first
      parseResult = parseChromeJsonBookmarkFile(content)

      // If Chrome format fails, we could add other JSON formats here
      if (parseResult.errors.length > 0 && parseResult.bookmarks.length === 0) {
        errors.push(
          'Unsupported JSON bookmark format. Currently only Chrome JSON format is supported.'
        )
      }
    } else {
      // HTML format
      parseResult = parseHtmlBookmarkFile(content)
    }

    if (parseResult.errors.length > 0) {
      errors.push(...parseResult.errors)
    }

    if (parseResult.bookmarks.length === 0) {
      errors.push('No bookmarks found in the file')
    }

    // Convert to bookmark format
    const { bookmarks, tagsToCreate } = convertToBookmarks(
      parseResult.bookmarks,
      createFolderTags,
      existingTags
    )

    return {
      bookmarksWithPaths: bookmarks,
      tagsToCreate,
      errors,
      browserType
    }
  } catch (error) {
    errors.push(
      `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    return {
      bookmarksWithPaths: [],
      tagsToCreate: [],
      errors,
      browserType: 'auto'
    }
  }
}
