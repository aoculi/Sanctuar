/**
 * Lock state management for PIN attempts and hard locking
 */

import { STORAGE_KEYS } from '@/lib/constants'
import { PIN_FAILED_ATTEMPTS_THRESHOLD } from '@/lib/pin'
import {
  clearStorageItem,
  getStorageItem,
  type LockState,
  setStorageItem
} from '@/lib/storage'

/**
 * Default lock state - unlocked with no failed attempts
 */
const DEFAULT_LOCK_STATE: LockState = {
  failedPinAttempts: 0,
  lastFailedAttempt: null,
  isHardLocked: false,
  hardLockedAt: null
}

/**
 * Get current lock state from storage
 */
export async function getLockState(): Promise<LockState> {
  const state = await getStorageItem<LockState>(STORAGE_KEYS.LOCK_STATE)
  return state || DEFAULT_LOCK_STATE
}

/**
 * Increment failed PIN attempts and trigger hard lock if threshold reached
 */
export async function incrementFailedPinAttempts(): Promise<LockState> {
  const state = await getLockState()
  const newAttempts = state.failedPinAttempts + 1

  const newState: LockState = {
    ...state,
    failedPinAttempts: newAttempts,
    lastFailedAttempt: Date.now(),
    isHardLocked: newAttempts >= PIN_FAILED_ATTEMPTS_THRESHOLD,
    hardLockedAt:
      newAttempts >= PIN_FAILED_ATTEMPTS_THRESHOLD
        ? Date.now()
        : state.hardLockedAt
  }

  await setStorageItem(STORAGE_KEYS.LOCK_STATE, newState)
  return newState
}

/**
 * Reset lock state on successful unlock
 */
export async function resetLockState(): Promise<void> {
  await clearStorageItem(STORAGE_KEYS.LOCK_STATE)
}
