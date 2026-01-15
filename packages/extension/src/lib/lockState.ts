/**
 * Lock state management for PIN attempts and hard locking
 */

import { PIN_FAILED_ATTEMPTS_THRESHOLD } from '@/lib/pin'
import {
  clearUserLockState,
  getUserLockState,
  setUserLockState,
  type LockState
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
 * Get current lock state from storage for a specific user
 */
export async function getLockState(userId: string): Promise<LockState> {
  return getUserLockState(userId)
}

/**
 * Increment failed PIN attempts and trigger hard lock if threshold reached
 */
export async function incrementFailedPinAttempts(
  userId: string
): Promise<LockState> {
  const state = await getLockState(userId)
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

  await setUserLockState(newState, userId)
  return newState
}

/**
 * Reset lock state on successful unlock for a specific user
 */
export async function resetLockState(userId: string): Promise<void> {
  await clearUserLockState(userId)
}
