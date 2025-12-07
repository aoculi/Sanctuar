/**
 * Chrome Storage and Settings utilities
 */

import {
  DEFAULT_AUTO_LOCK_TIMEOUT,
  DEFAULT_AUTO_LOCK_TIMEOUT_MS,
  STORAGE_KEYS
} from './constants'

/**
 * Settings interface
 */
export interface Settings {
  showHiddenTags: boolean
  apiUrl: string
  autoLockTimeout: string
}

/**
 * Check if chrome.storage.local is available
 */
function isStorageAvailable(): boolean {
  return !!chrome?.storage?.local
}

/**
 * Get value from chrome.storage.local
 * @param key - Storage key
 * @returns Promise resolving to the value or null if not found
 */
export function getStorageItem<T>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    if (!isStorageAvailable()) {
      console.warn('chrome.storage.local is not available')
      resolve(null)
      return
    }

    chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) {
        console.error('Storage get error:', chrome.runtime.lastError)
        resolve(null)
        return
      }
      resolve(result[key] ?? null)
    })
  })
}

/**
 * Set value in chrome.storage.local
 * @param key - Storage key
 * @param value - Value to store
 * @returns Promise resolving when storage is complete
 */
export function setStorageItem(key: string, value: any): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isStorageAvailable()) {
      reject(new Error('chrome.storage.local is not available'))
      return
    }

    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(
          new Error(chrome.runtime.lastError.message || 'Storage set failed')
        )
        return
      }
      resolve()
    })
  })
}

/**
 * Get settings from chrome.storage.local
 */
export function getSettings(): Promise<Settings | null> {
  return getStorageItem<Settings>(STORAGE_KEYS.SETTINGS)
}

/**
 * Set settings in chrome.storage.local
 */
export function setSettings(settings: Settings): Promise<void> {
  return setStorageItem(STORAGE_KEYS.SETTINGS, settings)
}

/**
 * Get default settings object
 */
export function getDefaultSettings(): Settings {
  return {
    showHiddenTags: false,
    apiUrl: '',
    autoLockTimeout: DEFAULT_AUTO_LOCK_TIMEOUT
  }
}

/**
 * Parse auto-lock timeout string to milliseconds
 */
export function parseAutoLockTimeout(timeout: string): number {
  const match = timeout.match(/^(\d+)(min|h)$/)
  if (!match) {
    return DEFAULT_AUTO_LOCK_TIMEOUT_MS
  }

  const value = parseInt(match[1], 10)
  const unit = match[2]

  if (unit === 'h') {
    return value * 60 * 60 * 1000
  } else {
    return value * 60 * 1000
  }
}

/**
 * Get auto-lock timeout from settings
 */
export async function getAutoLockTimeout(): Promise<number> {
  const settings = (await getSettings()) || getDefaultSettings()
  const timeout = parseAutoLockTimeout(
    settings.autoLockTimeout || DEFAULT_AUTO_LOCK_TIMEOUT
  )
  return timeout
}
