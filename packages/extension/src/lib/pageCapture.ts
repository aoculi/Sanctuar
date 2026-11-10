/**
 * Page capture utilities for popup/sidepanel
 * Handles getting current tab data and creating bookmark drafts
 */

import type { Bookmark } from '@/lib/types'
import { normalizeDescription } from '@/lib/validation'

declare const browser: typeof chrome | undefined

/** A draft bookmark created from captured page data */
export type BookmarkDraft = Omit<Bookmark, 'id' | 'created_at' | 'updated_at'>

export type CaptureResult =
  | { ok: true; bookmark: BookmarkDraft }
  | { ok: false; error: string }

export type MetadataResponse =
  | { ok: true; title: string; favicon: string; description: string }
  | { ok: false; error: string }

/**
 * Internal URLs that cannot be bookmarked
 */
const BLOCKED_URL_PREFIXES = ['chrome://', 'chrome-extension://', 'about:']

/**
 * Check if a URL is bookmarkable
 */
function isBookmarkableUrl(url: string): boolean {
  return !BLOCKED_URL_PREFIXES.some((prefix) => url.startsWith(prefix))
}

/**
 * Runs inside the page (injected) and returns its short description, if any.
 * Must stay self-contained: it is serialized with toString() for Firefox MV2.
 */
function extractDescriptionFromDocument(): string {
  const selectors = [
    'meta[name="description" i]',
    'meta[property="og:description" i]',
    'meta[name="og:description" i]',
    'meta[name="twitter:description" i]'
  ]
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.getAttribute('content')
    if (value && value.trim()) return value
  }
  return ''
}

const DESCRIPTION_TIMEOUT_MS = 800

/**
 * Read the description of an open tab from its DOM.
 * - Firefox MV2: tabs.executeScript (covered by the existing <all_urls> host permission)
 * - Chrome MV3: scripting.executeScript (needs the "scripting" permission)
 * Returns '' when the page can't be scripted (internal pages, AMO, PDFs…).
 */
async function readTabDescription(tabId: number | undefined): Promise<string> {
  if (tabId === undefined) return ''

  const withTimeout = <T>(promise: Promise<T>) =>
    Promise.race([
      promise,
      new Promise<undefined>((resolve) =>
        setTimeout(() => resolve(undefined), DESCRIPTION_TIMEOUT_MS)
      )
    ])

  try {
    const ffTabs =
      typeof browser !== 'undefined' ? (browser.tabs as any) : undefined
    if (ffTabs && typeof ffTabs.executeScript === 'function') {
      const results = (await withTimeout(
        ffTabs.executeScript(tabId, {
          code: `(${extractDescriptionFromDocument.toString()})()`
        }) as Promise<unknown[]>
      )) as unknown[] | undefined
      const value = results?.[0]
      return normalizeDescription(typeof value === 'string' ? value : '')
    }

    if (chrome.scripting?.executeScript) {
      const results = await withTimeout(
        chrome.scripting.executeScript({
          target: { tabId },
          func: extractDescriptionFromDocument
        })
      )
      const value = results?.[0]?.result
      return normalizeDescription(typeof value === 'string' ? value : '')
    }
  } catch {
    // Restricted page or no permission: no description
  }
  return ''
}

/**
 * Gets all open tabs in all windows
 * @returns Array of bookmark drafts from all open tabs
 */
export async function captureAllTabs(): Promise<BookmarkDraft[]> {
  try {
    // Check if chrome.tabs is available
    if (!chrome.tabs || typeof chrome.tabs.query !== 'function') {
      return []
    }

    // Query for all tabs
    const queryOptions = {}
    let tabs: chrome.tabs.Tab[]

    // Try Promise-based approach first (Manifest V3)
    const queryResult = chrome.tabs.query(queryOptions)
    if (queryResult && typeof queryResult.then === 'function') {
      tabs = await queryResult
    } else {
      // Fallback to callback-based API
      tabs = await new Promise<chrome.tabs.Tab[]>((resolve, reject) => {
        chrome.tabs.query(queryOptions, (tabs) => {
          if (chrome.runtime.lastError) {
            reject(
              new Error(chrome.runtime.lastError.message || 'Unknown error')
            )
            return
          }
          resolve(tabs || [])
        })
      })
    }

    if (!tabs || tabs.length === 0) {
      return []
    }

    // Filter and convert tabs to bookmark drafts
    const bookmarks: BookmarkDraft[] = []
    for (const tab of tabs) {
      if (!tab?.url || !tab?.title) {
        continue
      }

      if (!isBookmarkableUrl(tab.url)) {
        continue
      }

      bookmarks.push({
        url: tab.url,
        title: tab.title,
        note: '',
        picture: tab.favIconUrl || '',
        tags: []
      })
    }

    return bookmarks
  } catch (error) {
    console.error('Error capturing all tabs:', error)
    return []
  }
}

/**
 * Captures the current page data and returns a bookmark draft.
 * Uses chrome.tabs.query directly to get the current active tab.
 *
 * @returns A result object containing either a bookmark draft or an error message
 */
export async function captureCurrentPage(): Promise<CaptureResult> {
  try {
    // Check if chrome.tabs is available
    if (!chrome.tabs || typeof chrome.tabs.query !== 'function') {
      return {
        ok: false,
        error: 'Unable to get current page information'
      }
    }

    // Query for the active tab in the current window
    const queryOptions = { active: true, currentWindow: true }
    let tabs: chrome.tabs.Tab[]

    // Try Promise-based approach first (Manifest V3)
    const queryResult = chrome.tabs.query(queryOptions)
    if (queryResult && typeof queryResult.then === 'function') {
      tabs = await queryResult
    } else {
      // Fallback to callback-based API
      tabs = await new Promise<chrome.tabs.Tab[]>((resolve, reject) => {
        chrome.tabs.query(queryOptions, (tabs) => {
          if (chrome.runtime.lastError) {
            reject(
              new Error(chrome.runtime.lastError.message || 'Unknown error')
            )
            return
          }
          resolve(tabs || [])
        })
      })
    }

    if (!tabs || tabs.length === 0) {
      return {
        ok: false,
        error: 'Unable to get current page information'
      }
    }

    const tab = tabs[0]

    if (!tab?.url || !tab?.title) {
      return {
        ok: false,
        error: 'Unable to get current page information'
      }
    }

    if (!isBookmarkableUrl(tab.url)) {
      return {
        ok: false,
        error: 'Cannot bookmark internal browser pages'
      }
    }

    const description = await readTabDescription(tab.id)

    return {
      ok: true,
      bookmark: {
        url: tab.url,
        title: tab.title,
        note: '',
        description,
        picture: tab.favIconUrl || '',
        tags: []
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to get current page'
    return {
      ok: false,
      error: errorMessage
    }
  }
}

/**
 * Extract favicon URL from HTML or construct default
 */
function extractFavicon(html: string, baseUrl: string): string {
  try {
    const url = new URL(baseUrl)
    const baseOrigin = url.origin

    // Try to find favicon in various formats
    const patterns = [
      /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i
    ]

    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        let faviconUrl = match[1]
        // Handle relative URLs
        if (faviconUrl.startsWith('//')) {
          faviconUrl = `${url.protocol}${faviconUrl}`
        } else if (faviconUrl.startsWith('/')) {
          faviconUrl = `${baseOrigin}${faviconUrl}`
        } else if (!faviconUrl.startsWith('http')) {
          faviconUrl = new URL(faviconUrl, baseUrl).href
        }
        return faviconUrl
      }
    }

    // Fallback to default favicon location
    return `${baseOrigin}/favicon.ico`
  } catch {
    // If URL parsing fails, return empty string
    return ''
  }
}

/**
 * Extract title from HTML
 */
function extractTitle(html: string, fallbackUrl: string): string {
  // Try to find title tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim()
  }

  // Try Open Graph title
  const ogTitleMatch = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
  )
  if (ogTitleMatch && ogTitleMatch[1]) {
    return ogTitleMatch[1].trim()
  }

  // Fallback to hostname
  try {
    return new URL(fallbackUrl).hostname
  } catch {
    return fallbackUrl
  }
}

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
}

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    const lower = String(entity).toLowerCase()
    if (lower.startsWith('#')) {
      const code = lower.startsWith('#x')
        ? parseInt(lower.slice(2), 16)
        : parseInt(lower.slice(1), 10)
      try {
        return Number.isFinite(code) ? String.fromCodePoint(code) : match
      } catch {
        return match
      }
    }
    return HTML_ENTITIES[lower] ?? match
  })
}

/**
 * Extract the page description (meta description, then og:/twitter:)
 * from raw HTML. Attribute order and quoting vary, so parse each <meta>.
 */
function extractDescription(html: string): string {
  const metaTags = html.slice(0, 500_000).match(/<meta\b[^>]*>/gi) || []
  const found: Record<string, string> = {}
  for (const tag of metaTags) {
    const attrs: Record<string, string> = {}
    for (const m of tag.matchAll(
      /([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g
    )) {
      attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ''
    }
    const key = (attrs.name || attrs.property || '').toLowerCase()
    if (key && attrs.content?.trim() && !(key in found)) {
      found[key] = attrs.content
    }
  }
  const raw =
    found['description'] ||
    found['og:description'] ||
    found['twitter:description'] ||
    ''
  return normalizeDescription(decodeHtmlEntities(raw))
}

/**
 * Fetch metadata from a URL
 */
export async function fetchMetadata(url: string): Promise<MetadataResponse> {
  try {
    // Validate URL
    const parsedUrl = new URL(url)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return {
        ok: false,
        error: 'Invalid URL protocol. Only http:// and https:// are supported.'
      }
    }

    // Fetch the page
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      redirect: 'follow'
    })

    if (!response.ok) {
      return {
        ok: false,
        error: `Failed to fetch page: ${response.status} ${response.statusText}`
      }
    }

    const html = await response.text()
    const title = extractTitle(html, response.url || url)
    const favicon = extractFavicon(html, response.url || url)
    const description = extractDescription(html)

    return {
      ok: true,
      title,
      favicon,
      description
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch metadata'
    return {
      ok: false,
      error: errorMessage
    }
  }
}

/**
 * Refresh bookmark metadata by fetching the page and extracting title, favicon
 * and description
 * This function communicates with the background script to fetch metadata
 * @param url - The URL to fetch metadata from
 * @returns Promise with metadata result
 */
export async function refreshBookmarkMetadata(
  url: string
): Promise<MetadataResponse> {
  // Validate URL first
  if (!url || !url.trim()) {
    return {
      ok: false,
      error: 'URL is required'
    }
  }

  try {
    // Validate URL format
    const parsed = new URL(url.trim())
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        ok: false,
        error: 'URL must start with http:// or https://'
      }
    }
  } catch {
    return {
      ok: false,
      error: 'Invalid URL format'
    }
  }

  // Send message to background script
  return new Promise((resolve) => {
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      resolve({
        ok: false,
        error: 'Extension runtime is not available'
      })
      return
    }

    chrome.runtime.sendMessage(
      { type: 'FETCH_METADATA', url: url.trim() },
      (response: MetadataResponse) => {
        if (chrome.runtime.lastError) {
          resolve({
            ok: false,
            error:
              chrome.runtime.lastError.message ||
              'Failed to communicate with background script'
          })
          return
        }

        if (!response) {
          resolve({
            ok: false,
            error: 'No response from background script'
          })
          return
        }

        resolve(response)
      }
    )
  })
}
