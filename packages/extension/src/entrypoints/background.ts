/**
 * Background script for handling cross-origin requests
 * Fetches metadata (title and favicon) from URLs
 * Updates extension icon based on authentication state
 */

import { STORAGE_KEYS } from '@/lib/constants'
import { fetchMetadata, type MetadataResponse } from '@/lib/pageCapture'
import type { AuthSession } from '@/components/hooks/providers/useAuthSessionProvider'

// Firefox browser API global
declare const browser: typeof chrome | undefined

interface FetchMetadataMessage {
  type: 'FETCH_METADATA'
  url: string
}

/**
 * Update extension icon based on authentication state
 * Works with both Chrome MV3 (action) and Firefox MV2 (browserAction)
 */
async function updateIconForAuthState(isAuthenticated: boolean) {
  try {
    const iconPaths = isAuthenticated
      ? {
          // User is authenticated - use default icons
          16: '/icons/16.png',
          32: '/icons/32.png',
          48: '/icons/48.png',
          128: '/icons/128.png'
        }
      : {
          // User is not authenticated - use locked icon variant
          16: '/icon-locked-16.png',
          32: '/icon-locked-32.png',
          48: '/icon-locked-48.png',
          128: '/icon-locked-128.png'
        }

    // Firefox MV2 uses browser.browserAction
    if (typeof browser !== 'undefined' && browser.browserAction) {
      await browser.browserAction.setIcon({ path: iconPaths })
    }
    // Chrome MV3 uses chrome.action
    else if (chrome.action) {
      await chrome.action.setIcon({ path: iconPaths })
    }
    // Fallback for older Chrome (MV2) - chrome.browserAction
    else if (chrome.browserAction) {
      await chrome.browserAction.setIcon({ path: iconPaths })
    }
  } catch (error) {
    console.error('Failed to update extension icon:', error)
  }
}

/**
 * Check current authentication state
 * Works with both Firefox (browser) and Chrome (chrome) APIs
 * Returns true only if both session AND keystore exist (fully unlocked)
 */
async function checkAuthState(): Promise<boolean> {
  try {
    // Use browser API for Firefox, chrome API for Chrome
    const storageApi =
      typeof browser !== 'undefined' && browser.storage
        ? browser.storage
        : chrome.storage

    const result = await storageApi.local.get([
      STORAGE_KEYS.SESSION,
      STORAGE_KEYS.KEYSTORE
    ])
    const authSession = result[STORAGE_KEYS.SESSION] as AuthSession | undefined
    const keystore = result[STORAGE_KEYS.KEYSTORE]

    // User is fully unlocked only if both session AND keystore exist
    return !!(
      authSession &&
      authSession.token &&
      authSession.expiresAt &&
      authSession.expiresAt > Date.now() &&
      keystore
    )
  } catch (error) {
    console.error('Failed to check auth state:', error)
    return false
  }
}

export default defineBackground(() => {
  // Initialize icon on startup
  checkAuthState().then(updateIconForAuthState)

  // Use cross-browser storage API
  const storageApi =
    typeof browser !== 'undefined' && browser.storage
      ? browser.storage
      : chrome.storage

  // Listen for storage changes to update icon when auth state changes
  storageApi.onChanged.addListener((changes, areaName) => {
    if (
      areaName === 'local' &&
      (changes[STORAGE_KEYS.SESSION] || changes[STORAGE_KEYS.KEYSTORE])
    ) {
      // Re-check full auth state when either session or keystore changes
      checkAuthState().then(updateIconForAuthState)
    }
  })

  // Listen for messages from popup/content scripts
  chrome.runtime.onMessage.addListener(
    (
      message: FetchMetadataMessage,
      sender,
      sendResponse: (response: MetadataResponse) => void
    ) => {
      if (message.type === 'FETCH_METADATA') {
        fetchMetadata(message.url)
          .then(sendResponse)
          .catch((error) => {
            sendResponse({
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Unknown error occurred'
            })
          })
        // Return true to indicate we will send a response asynchronously
        return true
      }
    }
  )
})
