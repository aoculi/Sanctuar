import {
  DEFAULT_AUTO_LOCK_TIMEOUT,
  DEFAULT_AUTO_LOCK_TIMEOUT_MS,
  STORAGE_KEYS
} from '@/lib/constants'
import { getLockStateKey, getPinStoreKey } from '@/lib/constants'

/**
 * Settings interface
 * Note: apiUrl is stored separately in STORAGE_KEYS.API_URL (global, not per-user)
 */
export interface Settings {
  showHiddenBookmarks: boolean
  autoLockTimeout: string
  useCodePin: boolean
  theme: 'dark' | 'light'
}

/**
 * AAD context for authenticated encryption (used in PIN store)
 */
export type AadContext = {
  userId: string
  vaultId: string
  wmkLabel: string
  manifestLabel: string
}

/**
 * PIN store data - contains PIN-encrypted MAK for quick unlock
 */
export interface PinStoreData {
  pinHash: string // Argon2id hash for verification
  pinHashSalt: string // Salt for PIN hash (base64)
  pinKeySalt: string // Salt for PIN encryption key (base64)
  encryptedMak: string // MAK encrypted with PIN (base64: nonce || ciphertext)
  aadContext: AadContext // For manifest decryption
  userId: string
  vaultId: string
  version: number // For migrations
}

/**
 * Lock state tracking for PIN attempts
 */
export interface LockState {
  failedPinAttempts: number
  lastFailedAttempt: number | null
  isHardLocked: boolean // Requires password
  hardLockedAt: number | null
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
 * Get settings key for a specific user
 */
function getSettingsKey(userId: string | null): string {
  if (!userId) {
    return STORAGE_KEYS.SETTINGS // Fallback to global key if no userId
  }
  return `${STORAGE_KEYS.SETTINGS}:${userId}`
}

/**
 * Get settings from chrome.storage.local for a specific user
 */
export function getSettings(
  userId: string | null = null
): Promise<Settings | null> {
  const key = getSettingsKey(userId)
  return getStorageItem<Settings>(key)
}

/**
 * Set settings in chrome.storage.local for a specific user
 * @throws StorageError if storage operation fails
 */
export function setSettings(
  settings: Settings,
  userId: string | null = null
): Promise<void> {
  const key = getSettingsKey(userId)
  return setStorageItem(key, settings)
}

/**
 * Get default settings object
 */
export function getDefaultSettings(): Settings {
  return {
    showHiddenBookmarks: false,
    autoLockTimeout: DEFAULT_AUTO_LOCK_TIMEOUT,
    useCodePin: false,
    theme: 'dark'
  }
}

/**
 * Default API URL
 */
export const DEFAULT_API_URL = 'http://127.0.0.1:3500'

/**
 * Get API URL from storage (global setting, not user-specific)
 * @returns API URL string, defaults to DEFAULT_API_URL if not set
 */
export async function getApiUrl(): Promise<string> {
  const storedUrl = await getStorageItem<string>(STORAGE_KEYS.API_URL)
  if (storedUrl && storedUrl.trim() !== '') {
    return storedUrl.trim()
  }
  // Return default if not set
  return DEFAULT_API_URL
}

/**
 * Set API URL in storage (global setting, not user-specific)
 * @param url - API URL to store
 */
export async function setApiUrl(url: string): Promise<void> {
  await setStorageItem(STORAGE_KEYS.API_URL, url.trim())
}

/**
 * Parse auto-lock timeout string to milliseconds
 */
export function parseAutoLockTimeout(timeout: string): number {
  if (timeout === 'never') {
    return Infinity
  }

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
export async function getAutoLockTimeout(
  userId: string | null = null
): Promise<number> {
  const settings = (await getSettings(userId)) || getDefaultSettings()
  const timeout = parseAutoLockTimeout(
    settings.autoLockTimeout || DEFAULT_AUTO_LOCK_TIMEOUT
  )
  return timeout
}

/**
 * Get PIN store for a specific user
 */
export async function getPinStore(
  userId: string
): Promise<PinStoreData | null> {
  const key = getPinStoreKey(userId)
  return getStorageItem<PinStoreData>(key)
}

/**
 * Set PIN store for a specific user
 */
export async function setPinStore(
  data: PinStoreData,
  userId: string
): Promise<void> {
  const key = getPinStoreKey(userId)
  return setStorageItem(key, data)
}

/**
 * Clear PIN store for a specific user
 */
export async function clearPinStore(userId: string): Promise<void> {
  const key = getPinStoreKey(userId)
  return clearStorageItem(key)
}

/**
 * Get lock state for a specific user
 */
export async function getUserLockState(userId: string): Promise<LockState> {
  const key = getLockStateKey(userId)
  const state = await getStorageItem<LockState>(key)
  return (
    state || {
      failedPinAttempts: 0,
      lastFailedAttempt: null,
      isHardLocked: false,
      hardLockedAt: null
    }
  )
}

/**
 * Set lock state for a specific user
 */
export async function setUserLockState(
  state: LockState,
  userId: string
): Promise<void> {
  const key = getLockStateKey(userId)
  return setStorageItem(key, state)
}

/**
 * Clear lock state for a specific user
 */
export async function clearUserLockState(userId: string): Promise<void> {
  const key = getLockStateKey(userId)
  return clearStorageItem(key)
}
