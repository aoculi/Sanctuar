/**
 * Bookmark import functionality
 * Supports Chrome, Firefox, and Safari bookmark exports
 */

import type { Bookmark, Tag } from './types'

export type BrowserType = 'chrome' | 'firefox' | 'safari' | 'auto'

function isValidBookmarkUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:' ||
      parsed.protocol === 'javascript:'
    )
  } catch {
    return false
  }
}

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

interface FirefoxBookmarkNode {
  guid: string
  title: string
  typeCode: number
  type: string
  uri?: string
  dateAdded?: number
  lastModified?: number
  children?: FirefoxBookmarkNode[]
  root?: string
  index?: number
  iconUri?: string
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

    function chromeTimestampToMs(timestamp: string): number {
      const chromeEpoch = Date.UTC(1601, 0, 1)
      const microseconds = parseInt(timestamp, 10)
      return chromeEpoch + Math.floor(microseconds / 1000)
    }

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

        if (!isValidBookmarkUrl(node.url)) {
          errors.push(`Invalid URL: ${node.url} (${node.name || 'Unknown'})`)
          return
        }

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

        if (node.children && Array.isArray(node.children)) {
          node.children.forEach((child) => traverseNode(child, newPath))
        }
      }
    }
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

export function parseFirefoxJsonBookmarkFile(content: string): ImportResult {
  const bookmarks: ParsedBookmark[] = []
  const folders = new Set<string>()
  const errors: string[] = []

  try {
    const data: FirefoxBookmarkNode = JSON.parse(content)

    if (!data.guid || data.guid !== 'root________') {
      errors.push('Invalid Firefox bookmark JSON format: missing root')
      return { bookmarks, folders: [], errors }
    }

    function firefoxTimestampToMs(timestamp: number): number {
      return Math.floor(timestamp / 1000)
    }

    function traverseNode(
      node: FirefoxBookmarkNode,
      folderPath: string[] = []
    ): void {
      if (node.typeCode === 1) {
        if (!node.uri) {
          errors.push(`Bookmark missing URI: ${node.title || 'Unknown'}`)
          return
        }

        if (!isValidBookmarkUrl(node.uri)) {
          errors.push(`Invalid URI: ${node.uri} (${node.title || 'Unknown'})`)
          return
        }

        folderPath.forEach((folder) => {
          if (folder) folders.add(folder)
        })

        const addDate = node.dateAdded
          ? firefoxTimestampToMs(node.dateAdded)
          : undefined
        const lastModified = node.lastModified
          ? firefoxTimestampToMs(node.lastModified)
          : undefined

        bookmarks.push({
          url: node.uri,
          title: node.title || 'Untitled',
          folderPath: [...folderPath].filter(Boolean),
          addDate,
          lastModified
        })
      } else if (node.typeCode === 2) {
        const folderName = node.title || 'Untitled Folder'
        if (folderName) {
          const newPath = [...folderPath, folderName]
          folders.add(folderName)

          if (node.children && Array.isArray(node.children)) {
            node.children.forEach((child) => traverseNode(child, newPath))
          }
        } else if (node.children && Array.isArray(node.children)) {
          node.children.forEach((child) => traverseNode(child, folderPath))
        }
      }
    }

    if (data.children && Array.isArray(data.children)) {
      data.children.forEach((child) => traverseNode(child, []))
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

  if (!content.includes('NETSCAPE-Bookmark-file-1')) {
    errors.push(
      'Invalid bookmark file format. Expected Netscape Bookmark File Format.'
    )
    return { bookmarks, folders: [], errors }
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'text/html')

  function getFolderPath(linkElement: Element): string[] {
    const path: string[] = []
    let bookmarkDl: Element | null = linkElement

    while (bookmarkDl && bookmarkDl.tagName !== 'DL') {
      bookmarkDl = bookmarkDl.parentElement
    }

    if (!bookmarkDl) {
      return path
    }

    let currentDl: Element | null = bookmarkDl

    while (currentDl) {
      let dt: Element | null = currentDl.parentElement
      while (dt && dt.tagName !== 'DT') {
        dt = dt.parentElement
      }

      if (!dt) {
        break
      }

      const h3 = dt.querySelector('H3')
      if (h3?.textContent?.trim()) {
        path.unshift(h3.textContent.trim())
      }

      let parentDl: Element | null = dt.parentElement
      while (parentDl && parentDl.tagName !== 'DL') {
        parentDl = parentDl.parentElement
      }

      if (!parentDl) {
        break
      }

      currentDl = parentDl
    }

    return path
  }

  const links = doc.querySelectorAll('A[HREF]')

  links.forEach((link) => {
    try {
      const href = link.getAttribute('HREF')
      const title = link.textContent?.trim() || 'Untitled'

      if (!href) {
        errors.push(`Bookmark missing URL: ${title}`)
        return
      }

      // Validate URL (allow javascript: protocol for bookmarklets)
      if (!isValidBookmarkUrl(href)) {
        errors.push(`Invalid URL: ${href} (${title})`)
        return
      }

      const addDate = link.getAttribute('ADD_DATE')
      const lastModified = link.getAttribute('LAST_MODIFIED')

      const folderPath = getFolderPath(link)
      folderPath.forEach((folder) => folders.add(folder))

      bookmarks.push({
        url: href,
        title,
        folderPath,
        addDate: addDate ? parseInt(addDate, 10) * 1000 : undefined,
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
  existingTags.forEach((tag) => {
    tagNameToId.set(tag.name.toLowerCase(), tag.id)
  })

  if (createFolderTags) {
    const folderSet = new Set<string>()
    parsedBookmarks.forEach((bookmark) => {
      bookmark.folderPath.forEach((folder) => folderSet.add(folder))
    })

    folderSet.forEach((folderName) => {
      const lowerName = folderName.toLowerCase()
      if (
        !tagNameToId.has(lowerName) &&
        !tagsToCreate.some((t) => t.name.toLowerCase() === lowerName)
      ) {
        tagsToCreate.push({
          name: folderName,
          hidden: false
        })
      }
    })
  }

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
    const tagIds = new Set(bookmark.tags || [])

    folderPath.forEach((folder) => {
      const tagId = tagNameToId.get(folder.toLowerCase())
      if (tagId) {
        tagIds.add(tagId)
      }
    })

    return {
      url: bookmark.url,
      title: bookmark.title,
      note: bookmark.note,
      picture: bookmark.picture,
      tags: Array.from(tagIds)
    }
  })
}

/**
 * Detect file format (HTML or JSON)
 */
function detectFileFormat(content: string): 'html' | 'json' | 'unknown' {
  const trimmed = content.trim()

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      return 'json'
    } catch {
      // Not valid JSON
    }
  }

  if (
    trimmed.includes('NETSCAPE-Bookmark-file-1') ||
    trimmed.includes('<HTML>') ||
    trimmed.includes('<html>')
  ) {
    return 'html'
  }

  return 'unknown'
}

function detectJsonFormat(content: string): 'chrome' | 'firefox' | 'unknown' {
  try {
    const parsed = JSON.parse(content)

    if (parsed.guid === 'root________' && parsed.root === 'placesRoot') {
      return 'firefox'
    }

    if (parsed.version && parsed.roots) {
      return 'chrome'
    }
  } catch {
    // Not valid JSON
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
    const content = await file.text()
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

    const browserType = detectBrowserType(file.name, content)
    let parseResult: ImportResult

    if (format === 'json') {
      const jsonFormat = detectJsonFormat(content)
      if (jsonFormat === 'firefox') {
        parseResult = parseFirefoxJsonBookmarkFile(content)
      } else if (jsonFormat === 'chrome') {
        parseResult = parseChromeJsonBookmarkFile(content)
      } else {
        errors.push(
          'Unsupported JSON bookmark format. Only Chrome and Firefox JSON formats are supported.'
        )
        return {
          bookmarksWithPaths: [],
          tagsToCreate: [],
          errors,
          browserType: 'auto'
        }
      }
    } else {
      parseResult = parseHtmlBookmarkFile(content)
    }

    if (parseResult.errors.length > 0 && parseResult.bookmarks.length === 0) {
      errors.push('Failed to parse bookmark file. No bookmarks were extracted.')
    }

    if (parseResult.errors.length > 0) {
      errors.push(...parseResult.errors)
    }

    if (parseResult.bookmarks.length === 0) {
      errors.push('No bookmarks found in the file')
    }

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
