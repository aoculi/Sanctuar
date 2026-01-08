import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'

import type { KdfParams, LoginResponse } from '@/api/auth-api'
import { fetchRefreshToken } from '@/api/auth-api'
import { MIN_REFRESH_INTERVAL, STORAGE_KEYS } from '@/lib/constants'
import {
  clearStorageItem,
  getStorageItem,
  setStorageItem,
  type PinStoreData
} from '@/lib/storage'

export type AuthSession = {
  userId: string | null
  token: string | null
  expiresAt: number | null
  createdAt: number | null
  kdf: KdfParams | null
  wrappedMk: string | null
}

type AuthSessionContextType = {
  isLoading: boolean
  session: AuthSession
  isAuthenticated: boolean
  setSession: (response: LoginResponse) => Promise<void>
  clearSession: (lockMode?: 'soft' | 'hard') => Promise<void>
}

const defaultSession: AuthSession = {
  userId: null,
  token: null,
  expiresAt: null,
  createdAt: null,
  kdf: null,
  wrappedMk: null
}

export const AuthSessionContext = createContext<AuthSessionContextType>({
  isLoading: true,
  session: defaultSession,
  isAuthenticated: false,
  setSession: async () => {},
  clearSession: async () => {}
})

export const useAuthSession = () => {
  const context = useContext(AuthSessionContext)
  if (!context) {
    throw new Error('useAuthSession must be used within an AuthSessionProvider')
  }
  return context
}

type AuthSessionProviderProps = {
  children: ReactNode
}

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  const [session, setSessionState] = useState<AuthSession>(defaultSession)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const clearSession = useCallback(
    async (lockMode: 'soft' | 'hard' = 'hard') => {
      if (lockMode === 'soft') {
        // Soft lock: Keep SESSION, clear only KEYSTORE + MANIFEST
        // Check if PIN is configured to determine if soft lock is possible
        const pinStore = await getStorageItem<PinStoreData>(
          STORAGE_KEYS.PIN_STORE
        )
        if (pinStore) {
          await Promise.allSettled([
            clearStorageItem(STORAGE_KEYS.KEYSTORE).catch(() => {}),
            clearStorageItem(STORAGE_KEYS.MANIFEST).catch(() => {})
          ])
          return
        }
      }

      // Hard lock: Full logout
      setSessionState(defaultSession)
      setIsAuthenticated(false)

      await Promise.allSettled([
        clearStorageItem(STORAGE_KEYS.SESSION).catch(() => {}),
        clearStorageItem(STORAGE_KEYS.KEYSTORE).catch(() => {}),
        clearStorageItem(STORAGE_KEYS.MANIFEST).catch(() => {}),
        clearStorageItem(STORAGE_KEYS.PIN_STORE).catch(() => {}),
        clearStorageItem(STORAGE_KEYS.LOCK_STATE).catch(() => {}),
        clearStorageItem(STORAGE_KEYS.IS_SOFT_LOCKED).catch(() => {})
      ])
    },
    []
  )

  useEffect(() => {
    const loadAndRefreshSession = async () => {
      const session = await getStorageItem<AuthSession>(STORAGE_KEYS.SESSION)

      if (
        !session ||
        !session.token ||
        !session.expiresAt ||
        !session.createdAt
      ) {
        setIsAuthenticated(false)
        setIsLoading(false)
        return
      }

      const now = Date.now()
      const timeUntilExpiry = session.expiresAt - now

      if (timeUntilExpiry <= 0) {
        await clearSession()
        setIsLoading(false)
        return
      }

      const timeSinceCreation = now - session.createdAt

      if (timeSinceCreation > MIN_REFRESH_INTERVAL) {
        try {
          const refreshResponse = await fetchRefreshToken()
          const updatedSession: AuthSession = {
            ...session,
            token: refreshResponse.token,
            expiresAt: refreshResponse.expires_at
            // Keep original createdAt - don't reset auto-lock timer on token refresh
          }
          setSessionState(updatedSession)
          setIsAuthenticated(true)
          try {
            await setStorageItem(STORAGE_KEYS.SESSION, updatedSession)
          } catch (storageError) {
            console.warn(
              'Failed to save refreshed session to storage:',
              storageError
            )
          }
          setIsLoading(false)
          return
        } catch (error) {
          console.warn('Token refresh failed, using existing session:', error)
          setSessionState(session)
          setIsAuthenticated(true)
          setIsLoading(false)
          return
        }
      }

      // Session is still valid and within timeout
      setSessionState(session)
      setIsAuthenticated(true)
      setIsLoading(false)
    }

    loadAndRefreshSession()
  }, [clearSession])

  // Listen for storage changes to sync authentication state across windows/tabs
  useEffect(() => {
    const handleStorageChange = async (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      // Only react to local storage changes for the session key
      if (areaName !== 'local' || !changes[STORAGE_KEYS.SESSION]) {
        return
      }

      const change = changes[STORAGE_KEYS.SESSION]
      const newSession = change.newValue as AuthSession | undefined

      // Session was cleared (logout in another window)
      if (!newSession || !newSession.token) {
        setSessionState(defaultSession)
        setIsAuthenticated(false)
        return
      }

      // Session was created/updated (login or refresh in another window)
      setSessionState(newSession)
      setIsAuthenticated(true)
    }

    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  const setSession = useCallback(async (response: LoginResponse) => {
    const data: AuthSession = {
      userId: response.user_id,
      token: response.token,
      expiresAt: response.expires_at,
      createdAt: response.created_at,
      kdf: response.kdf,
      wrappedMk: response.wrapped_mk
    }

    setSessionState(data)
    setIsAuthenticated(true)

    try {
      await setStorageItem(STORAGE_KEYS.SESSION, data)

      // Verify it was saved - retry a few times in case of timing issues
      let verifySession: AuthSession | null = null
      for (let i = 0; i < 3; i++) {
        verifySession = await getStorageItem<AuthSession>(STORAGE_KEYS.SESSION)
        if (verifySession && verifySession.token) {
          break
        }
        if (i < 2) {
          // Wait a bit before retrying
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
      }

      if (!verifySession || !verifySession.token) {
        console.error(
          'Session verification failed: session not found in storage after retries'
        )
        throw new Error('Failed to verify session was saved')
      }
    } catch (error) {
      console.error('Failed to save session to storage:', error)
      throw error // Re-throw to ensure login fails if storage fails
    }
  }, [])

  const contextValue: AuthSessionContextType = {
    isLoading,
    session,
    isAuthenticated,
    setSession,
    clearSession
  }

  return (
    <AuthSessionContext.Provider value={contextValue}>
      {children}
    </AuthSessionContext.Provider>
  )
}
