import type { AuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { checkAndApplyAutoLock } from '@/components/hooks/providers/useUnlockStateProvider'
import { fetchRefreshToken } from '@/api/auth-api'
import { STORAGE_KEYS } from '@/lib/constants'
import { fetchMetadata, type MetadataResponse } from '@/lib/pageCapture'
import {
  hashUrl,
  isSavedUrlsMessage,
  type SavedUrlsMessage
} from '@/lib/savedBadge'
import { getSettings, getStorageItem, setStorageItem } from '@/lib/storage'

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

// ---------------------------------------------------------------------------
// "Already saved" badge
// ---------------------------------------------------------------------------

/**
 * SHA-256 hashes of the normalized URLs in the unlocked vault, sent by the
 * popup/app. Memory only: never written to storage, dropped on lock/logout.
 * null = no set (locked, badge disabled, or vault not opened since startup).
 */
let savedUrlHashes: Set<string> | null = null

const SAVED_BADGE_TEXT = '✓'
const SAVED_BADGE_COLOR = '#4d7c5a'

type BadgeApi = {
  setBadgeText(details: { text: string; tabId?: number }): unknown
  setBadgeBackgroundColor(details: { color: string; tabId?: number }): unknown
  setBadgeTextColor?(details: { color: string; tabId?: number }): unknown
}

/** Firefox MV2 (browserAction) or MV3 (action), like updateIconForAuthState */
function getBadgeApi(): BadgeApi | null {
  if (typeof browser !== 'undefined' && browser.browserAction) {
    return browser.browserAction as unknown as BadgeApi
  }
  if (chrome.action) return chrome.action as unknown as BadgeApi
  if (chrome.browserAction) return chrome.browserAction as unknown as BadgeApi
  return null
}

function getTabsApi(): typeof chrome.tabs {
  return typeof browser !== 'undefined' && browser.tabs
    ? browser.tabs
    : chrome.tabs
}

async function callBadge(fn: () => unknown): Promise<void> {
  try {
    await fn()
  } catch {
    // Tab closed in the meantime, or API unavailable
  }
}

async function setTabBadge(tabId: number, saved: boolean): Promise<void> {
  const api = getBadgeApi()
  if (!api) return
  await callBadge(() =>
    api.setBadgeText({ text: saved ? SAVED_BADGE_TEXT : '', tabId })
  )
  if (saved) {
    await callBadge(() =>
      api.setBadgeBackgroundColor({ color: SAVED_BADGE_COLOR, tabId })
    )
    if (api.setBadgeTextColor) {
      await callBadge(() =>
        api.setBadgeTextColor!({ color: '#ffffff', tabId })
      )
    }
  }
}

async function updateSavedBadgeForTab(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined) return
  if (!savedUrlHashes || !tab.url) {
    await setTabBadge(tab.id, false)
    return
  }
  const hash = await hashUrl(tab.url)
  // Re-check: the set may have been cleared while hashing
  await setTabBadge(tab.id, !!savedUrlHashes && savedUrlHashes.has(hash))
}

async function refreshSavedBadgesForActiveTabs(): Promise<void> {
  try {
    const tabs = await getTabsApi().query({ active: true })
    await Promise.all(tabs.map(updateSavedBadgeForTab))
  } catch (error) {
    console.warn('[Background] Failed to refresh saved badges:', error)
  }
}

/** Forget the URL set and remove every badge (lock, logout, setting off) */
async function clearSavedBadges(): Promise<void> {
  // No early return when the set is already null: an MV3 service worker
  // restart loses the set but not the badges it had drawn
  savedUrlHashes = null
  const api = getBadgeApi()
  if (!api) return
  await callBadge(() => api.setBadgeText({ text: '' }))
  try {
    const tabs = await getTabsApi().query({})
    await Promise.all(
      tabs.map((tab) =>
        tab.id === undefined ? undefined : setTabBadge(tab.id, false)
      )
    )
  } catch {
    // Ignore: badges are best effort
  }
}

async function isSavedBadgeEnabled(): Promise<boolean> {
  try {
    const session = await getStorageItem<AuthSession>(STORAGE_KEYS.SESSION)
    const settings = await getSettings(session?.userId ?? null)
    return settings?.showSavedBadge !== false
  } catch {
    return false
  }
}

function isFromExtensionPage(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id) return false
  const origin = chrome.runtime.getURL('')
  return !!sender.url && sender.url.startsWith(origin)
}

async function handleSavedUrlsUpdate(hashes: unknown): Promise<void> {
  if (
    !Array.isArray(hashes) ||
    !hashes.every((h) => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h))
  ) {
    return
  }
  // Ignore updates that arrive after a lock/logout or with the badge disabled
  if (!(await checkAuthState()) || !(await isSavedBadgeEnabled())) {
    await clearSavedBadges()
    return
  }
  savedUrlHashes = new Set(hashes)
  await refreshSavedBadgesForActiveTabs()
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

/**
 * Proactively refresh token before it expires
 * This keeps the session valid indefinitely (Proton-style behavior)
 * Only logs out on explicit user action
 */
async function proactiveTokenRefresh(): Promise<void> {
  try {
    const session = await getStorageItem<AuthSession>(STORAGE_KEYS.SESSION)
    if (!session || !session.token || !session.expiresAt) {
      return
    }

    const now = Date.now()
    const timeUntilExpiry = session.expiresAt - now
    
    // Refresh token if it expires in less than 5 minutes
    // This prevents the token from expiring while the extension is idle
    const REFRESH_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes
    
    if (timeUntilExpiry <= REFRESH_THRESHOLD_MS) {
      console.log('[Background] Proactively refreshing token...')
      try {
        const refreshResponse = await fetchRefreshToken()
        const updatedSession: AuthSession = {
          ...session,
          token: refreshResponse.token,
          expiresAt: refreshResponse.expires_at
        }
        await setStorageItem(STORAGE_KEYS.SESSION, updatedSession)
        console.log('[Background] Token refreshed successfully')
      } catch (error) {
        // Silent fail - will retry on next interval or when popup opens
        console.warn('[Background] Token refresh failed, will retry:', error)
      }
    }
  } catch (error) {
    console.error('[Background] Error in proactive token refresh:', error)
  }
}

export default defineBackground(() => {
  checkAuthState().then(updateIconForAuthState)

  const storageApi =
    typeof browser !== 'undefined' && browser.storage
      ? browser.storage
      : chrome.storage

  storageApi.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return

    // Lock (auto or soft) and logout remove the keystore/manifest or the
    // session: drop the saved-URL set and every badge right away
    const removed = (key: string) => !!changes[key] && !changes[key].newValue
    if (
      removed(STORAGE_KEYS.SESSION) ||
      removed(STORAGE_KEYS.KEYSTORE) ||
      removed(STORAGE_KEYS.MANIFEST) ||
      changes[STORAGE_KEYS.IS_SOFT_LOCKED]?.newValue === true
    ) {
      clearSavedBadges()
    }

    // Badge turned off in Settings
    if (
      Object.keys(changes).some(
        (key) =>
          key === STORAGE_KEYS.SETTINGS ||
          key.startsWith(`${STORAGE_KEYS.SETTINGS}:`)
      )
    ) {
      isSavedBadgeEnabled().then((enabled) => {
        if (!enabled) clearSavedBadges()
      })
    }

    if (
      changes[STORAGE_KEYS.SESSION] ||
      changes[STORAGE_KEYS.KEYSTORE] ||
      changes[STORAGE_KEYS.IS_SOFT_LOCKED]
    ) {
      checkAuthState().then((isAuthenticated) => {
        updateIconForAuthState(isAuthenticated)
        if (!isAuthenticated) clearSavedBadges()
      })
    }
  })

  // Keep the badge in sync with the active tab
  const tabsApi = getTabsApi()
  tabsApi.onActivated.addListener(({ tabId }) => {
    if (!savedUrlHashes) return
    Promise.resolve(tabsApi.get(tabId))
      .then((tab) => tab && updateSavedBadgeForTab(tab))
      .catch(() => {})
  })
  tabsApi.onUpdated.addListener((_tabId, changeInfo, tab) => {
    // Firefox resets per-tab badge text on navigation, so also re-apply
    // once loading completes
    if (changeInfo.url || changeInfo.status === 'complete') {
      updateSavedBadgeForTab(tab)
    }
  })
  const windowsApi =
    typeof browser !== 'undefined' && browser.windows
      ? browser.windows
      : chrome.windows
  windowsApi?.onFocusChanged.addListener((windowId) => {
    if (windowId === windowsApi.WINDOW_ID_NONE || !savedUrlHashes) return
    refreshSavedBadgesForActiveTabs()
  })

  const AUTO_LOCK_CHECK_INTERVAL = 30 * 1000
  setInterval(() => {
    checkAndApplyAutoLock()
  }, AUTO_LOCK_CHECK_INTERVAL)

  checkAndApplyAutoLock()

  // Proactive token refresh - keeps session valid indefinitely
  // Run every 5 minutes to check if token needs refreshing
  const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000
  setInterval(() => {
    proactiveTokenRefresh()
  }, TOKEN_REFRESH_INTERVAL)

  // Run initial token refresh check
  proactiveTokenRefresh()

  chrome.runtime.onMessage.addListener(
    (
      message: FetchMetadataMessage | SavedUrlsMessage,
      sender,
      sendResponse: (response: MetadataResponse) => void
    ) => {
      if (isSavedUrlsMessage(message)) {
        if (!isFromExtensionPage(sender)) return
        if (message.type === 'SAVED_URLS_UPDATE') {
          handleSavedUrlsUpdate(message.hashes)
        } else {
          clearSavedBadges()
        }
        return
      }

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
