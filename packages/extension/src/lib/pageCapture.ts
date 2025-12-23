/**
 * Page capture utilities for popup/sidepanel
 * Handles getting current tab data and creating bookmark drafts
 */

import type { Bookmark } from '@/lib/types'

/** A draft bookmark created from captured page data */
export type BookmarkDraft = Omit<Bookmark, 'id' | 'created_at' | 'updated_at'>

export type CaptureResult =
  | { ok: true; bookmark: BookmarkDraft }
  | { ok: false; error: string }

/**
 * Internal URLs that cannot be bookmarked
 */
const BLOCKED_URL_PREFIXES = ['chrome://', 'chrome-extension://', 'about:']

/**
 * Check if a URL is bookmarkable
 */
export function isBookmarkableUrl(url: string): boolean {
  return !BLOCKED_URL_PREFIXES.some((prefix) => url.startsWith(prefix))
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

    return {
      ok: true,
      bookmark: {
        url: tab.url,
        title: tab.title,
        note: '',
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
