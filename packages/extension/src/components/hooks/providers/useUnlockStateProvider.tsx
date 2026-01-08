import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'

import { STORAGE_KEYS } from '@/lib/constants'
import {
  clearStorageItem,
  getAutoLockTimeout,
  getSettings,
  getStorageItem,
  parseAutoLockTimeout,
  setStorageItem,
  type PinStoreData
} from '@/lib/storage'
import { useAuthSession, type AuthSession } from './useAuthSessionProvider'

declare const browser: typeof chrome | undefined

export type UnlockState =
  | 'unlocked'
  | 'locked'
  | 'not-authenticated'
  | 'loading'

type UnlockStateResult = {
  state: UnlockState
  canUnlockWithPin: boolean
}

type UnlockStateContextType = {
  isLoading: boolean
  unlockState: UnlockState
  isUnlocked: boolean
  isLocked: boolean
  canUnlockWithPin: boolean
  refreshUnlockState: () => Promise<void>
}

const UnlockStateContext = createContext<UnlockStateContextType>({
  isLoading: true,
  unlockState: 'loading',
  isUnlocked: false,
  isLocked: false,
  canUnlockWithPin: false,
  refreshUnlockState: async () => {}
})

export const useUnlockState = () => {
  const context = useContext(UnlockStateContext)
  if (!context) {
    throw new Error('useUnlockState must be used within an UnlockStateProvider')
  }
  return context
}

type UnlockStateProviderProps = {
  children: ReactNode
}

export async function checkAndApplyAutoLock(): Promise<void> {
  const storageApi =
    typeof browser !== 'undefined' && browser.storage
      ? browser.storage
      : chrome.storage

  const result = await storageApi.local.get([
    STORAGE_KEYS.SESSION,
    STORAGE_KEYS.KEYSTORE,
    STORAGE_KEYS.PIN_STORE,
    STORAGE_KEYS.IS_SOFT_LOCKED
  ])

  const session = result[STORAGE_KEYS.SESSION] as AuthSession | undefined
  const keystore = result[STORAGE_KEYS.KEYSTORE]
  const pinStore = result[STORAGE_KEYS.PIN_STORE] as PinStoreData | undefined
  const isLocked = result[STORAGE_KEYS.IS_SOFT_LOCKED] as boolean | undefined

  if (!session || !session.token || !session.createdAt || isLocked) {
    return
  }

  if (!keystore) {
    return
  }

  // Get settings for this user
  const settings = session.userId ? await getSettings(session.userId) : null
  const autoLockTimeout = settings?.autoLockTimeout || '20min'
  const autoLockTimeoutMs = parseAutoLockTimeout(autoLockTimeout)

  // If timeout is Infinity (never), don't auto-lock
  if (autoLockTimeoutMs === Infinity) {
    return
  }

  const now = Date.now()
  const timeSinceCreation = now - session.createdAt

  if (timeSinceCreation > autoLockTimeoutMs) {
    // If PIN is configured, lock and require PIN (soft lock - keep session)
    if (pinStore) {
      await storageApi.local.set({ [STORAGE_KEYS.IS_SOFT_LOCKED]: true })
      await storageApi.local.remove([
        STORAGE_KEYS.KEYSTORE,
        STORAGE_KEYS.MANIFEST
      ])
    }
    // If no PIN configured but timeout expired, this shouldn't happen
    // (timeout should be Infinity), but if it does, keep session unlocked
    // Don't clear session - user should stay logged in
  }
}

async function calculateUnlockState(
  isAuthenticated: boolean,
  session: AuthSession
): Promise<UnlockStateResult> {
  if (!isAuthenticated || !session.userId || !session.token) {
    return { state: 'not-authenticated', canUnlockWithPin: false }
  }

  const [keystore, isLocked, pinStore] = await Promise.all([
    getStorageItem(STORAGE_KEYS.KEYSTORE),
    getStorageItem<boolean>(STORAGE_KEYS.IS_SOFT_LOCKED),
    getStorageItem<PinStoreData>(STORAGE_KEYS.PIN_STORE)
  ])

  // Can unlock with PIN if PIN store exists
  const canUnlockWithPin = !!pinStore

  if (isLocked) {
    return { state: 'locked', canUnlockWithPin }
  }

  if (!keystore) {
    return { state: 'locked', canUnlockWithPin }
  }

  const autoLockTimeoutMs = await getAutoLockTimeout(session.userId)

  // If timeout is Infinity (never), stay unlocked
  if (autoLockTimeoutMs === Infinity) {
    return { state: 'unlocked', canUnlockWithPin: false }
  }

  if (!session.createdAt) {
    return { state: 'locked', canUnlockWithPin }
  }

  const now = Date.now()
  const timeSinceCreation = now - session.createdAt

  if (timeSinceCreation > autoLockTimeoutMs) {
    // If PIN is configured, lock and require PIN (soft lock - keep session)
    if (pinStore) {
      await setStorageItem(STORAGE_KEYS.IS_SOFT_LOCKED, true)
      await Promise.allSettled([
        clearStorageItem(STORAGE_KEYS.KEYSTORE).catch(() => {}),
        clearStorageItem(STORAGE_KEYS.MANIFEST).catch(() => {})
      ])
      return { state: 'locked', canUnlockWithPin: true }
    }
    // If no PIN configured but timeout expired, this shouldn't happen
    // (timeout should be Infinity), but if it does, keep unlocked
    // Don't return 'not-authenticated' - user should stay logged in
    return { state: 'unlocked', canUnlockWithPin: false }
  }

  return { state: 'unlocked', canUnlockWithPin: false }
}

export function UnlockStateProvider({ children }: UnlockStateProviderProps) {
  const { session, isAuthenticated } = useAuthSession()
  const [unlockState, setUnlockState] = useState<UnlockState>('loading')
  const [canUnlockWithPin, setCanUnlockWithPin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUnlockState = useCallback(async () => {
    const result = await calculateUnlockState(isAuthenticated, session)
    setUnlockState(result.state)
    setCanUnlockWithPin(result.canUnlockWithPin)
  }, [isAuthenticated, session])

  useEffect(() => {
    const loadState = async () => {
      setIsLoading(true)
      await refreshUnlockState()
      setIsLoading(false)
    }

    loadState()
  }, [refreshUnlockState])

  useEffect(() => {
    const interval = setInterval(() => {
      refreshUnlockState()
    }, 30000)

    return () => clearInterval(interval)
  }, [refreshUnlockState])

  useEffect(() => {
    const handleStorageChange = async (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== 'local') return

      const relevantKeys = [
        STORAGE_KEYS.SESSION,
        STORAGE_KEYS.KEYSTORE,
        STORAGE_KEYS.IS_SOFT_LOCKED,
        STORAGE_KEYS.SETTINGS,
        STORAGE_KEYS.PIN_STORE
      ]

      if (relevantKeys.some((key) => changes[key])) {
        await refreshUnlockState()
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [refreshUnlockState])

  const isUnlocked = unlockState === 'unlocked'
  const isLocked = unlockState === 'locked'

  const contextValue: UnlockStateContextType = {
    isLoading,
    unlockState,
    isUnlocked,
    isLocked,
    canUnlockWithPin,
    refreshUnlockState
  }

  return (
    <UnlockStateContext.Provider value={contextValue}>
      {children}
    </UnlockStateContext.Provider>
  )
}
