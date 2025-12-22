import {
  DEFAULT_AUTO_LOCK_TIMEOUT,
  DEFAULT_AUTO_LOCK_TIMEOUT_MS,
  STORAGE_KEYS
} from '@/lib/constants'

/**
 * Settings interface
 */
export interface Settings {
  showHiddenTags: boolean
  apiUrl: string
  autoLockTimeout: string
}

/**
 * Storage error class for handling storage operation failures
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly operation: 'get' | 'set' | 'remove',
    public readonly key: string,
    public readonly cause?: chrome.runtime.LastError
  ) {
    super(message)
    this.name = 'StorageError'
  }
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
 * @throws StorageError if storage operation fails
 */
export function getStorageItem<T>(key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    if (!isStorageAvailable()) {
      reject(
        new StorageError('chrome.storage.local is not available', 'get', key)
      )
      return
    }

    chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) {
        reject(
          new StorageError(
            `Failed to get storage item: ${chrome.runtime.lastError.message}`,
            'get',
            key,
            chrome.runtime.lastError
          )
        )
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
 * @returns Promise resolving to void on success
 * @throws StorageError if storage operation fails
 */
export function setStorageItem(key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isStorageAvailable()) {
      reject(
        new StorageError('chrome.storage.local is not available', 'set', key)
      )
      return
    }

    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(
          new StorageError(
            `Failed to set storage item: ${chrome.runtime.lastError.message}`,
            'set',
            key,
            chrome.runtime.lastError
          )
        )
        return
      }
      resolve()
    })
  })
}

/**
 * Remove value from chrome.storage.local
 * @param key - Storage key
 * @returns Promise resolving to void on success
 * @throws StorageError if storage operation fails
 */
export function clearStorageItem(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isStorageAvailable()) {
      reject(
        new StorageError('chrome.storage.local is not available', 'remove', key)
      )
      return
    }

    chrome.storage.local.remove(key, () => {
      if (chrome.runtime.lastError) {
        reject(
          new StorageError(
            `Failed to remove storage item: ${chrome.runtime.lastError.message}`,
            'remove',
            key,
            chrome.runtime.lastError
          )
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
 * @throws StorageError if storage operation fails
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
    apiUrl: 'http://127.0.0.1:3500',
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
