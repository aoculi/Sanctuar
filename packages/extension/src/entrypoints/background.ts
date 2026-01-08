import type { AuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { checkAndApplyAutoLock } from '@/components/hooks/providers/useUnlockStateProvider'
import { STORAGE_KEYS } from '@/lib/constants'
import { fetchMetadata, type MetadataResponse } from '@/lib/pageCapture'

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
          16: '/icons/16.png',
          32: '/icons/32.png',
          48: '/icons/48.png',
          128: '/icons/128.png'
        }
      : {
          16: '/icon-locked-16.png',
          32: '/icon-locked-32.png',
          48: '/icon-locked-48.png',
          128: '/icon-locked-128.png'
        }

    // Firefox MV2 uses browser.browserAction
    if (typeof browser !== 'undefined' && browser.browserAction) {
      await browser.browserAction.setIcon({ path: iconPaths })
    } else if (chrome.action) {
      await chrome.action.setIcon({ path: iconPaths })
    } else if (chrome.browserAction) {
      await chrome.browserAction.setIcon({ path: iconPaths })
    }
  } catch (error) {
    console.error('Failed to update extension icon:', error)
  }
}

async function checkAuthState(): Promise<boolean> {
  try {
    const storageApi =
      typeof browser !== 'undefined' && browser.storage
        ? browser.storage
        : chrome.storage

    const result = await storageApi.local.get([
      STORAGE_KEYS.SESSION,
      STORAGE_KEYS.KEYSTORE,
      STORAGE_KEYS.IS_SOFT_LOCKED
    ])
    const authSession = result[STORAGE_KEYS.SESSION] as AuthSession | undefined
    const keystore = result[STORAGE_KEYS.KEYSTORE]
    const isLocked = result[STORAGE_KEYS.IS_SOFT_LOCKED] as boolean | undefined

    return !!(
      authSession &&
      authSession.token &&
      authSession.expiresAt &&
      authSession.expiresAt > Date.now() &&
      keystore &&
      !isLocked
    )
  } catch (error) {
    console.error('Failed to check auth state:', error)
    return false
  }
}

export default defineBackground(() => {
  checkAuthState().then(updateIconForAuthState)

  const storageApi =
    typeof browser !== 'undefined' && browser.storage
      ? browser.storage
      : chrome.storage

  storageApi.onChanged.addListener((changes, areaName) => {
    if (
      areaName === 'local' &&
      (changes[STORAGE_KEYS.SESSION] ||
        changes[STORAGE_KEYS.KEYSTORE] ||
        changes[STORAGE_KEYS.IS_SOFT_LOCKED])
    ) {
      checkAuthState().then(updateIconForAuthState)
    }
  })

  const AUTO_LOCK_CHECK_INTERVAL = 30 * 1000
  setInterval(() => {
    checkAndApplyAutoLock()
  }, AUTO_LOCK_CHECK_INTERVAL)

  checkAndApplyAutoLock()

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
        return true
      }
    }
  )
})
