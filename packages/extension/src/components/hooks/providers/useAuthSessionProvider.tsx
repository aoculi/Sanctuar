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
  getAutoLockTimeout,
  getStorageItem,
  setStorageItem
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
  clearSession: () => Promise<void>
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

  const clearSession = useCallback(async () => {
    setSessionState(defaultSession)
    setIsAuthenticated(false)

    await Promise.allSettled([
      clearStorageItem(STORAGE_KEYS.SESSION).catch(() => {}),
      clearStorageItem(STORAGE_KEYS.KEYSTORE).catch(() => {}),
      clearStorageItem(STORAGE_KEYS.MANIFEST).catch(() => {})
    ])
  }, [])

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

      // Token has expired - clear session
      if (timeUntilExpiry <= 0) {
        await clearSession()
        setIsLoading(false)
        return
      }

      // Get auto-lock timeout (defaults to 20 minutes if settings not configured)
      const autoLockTimeoutMs = await getAutoLockTimeout()

      // Calculate time since session was created/refreshed
      const sessionCreatedAt = session.createdAt
      const timeSinceCreation = now - sessionCreatedAt

      // If session was created/refreshed longer ago than autoLockTimeout, clear it
      // (even if token is still technically valid)
      if (timeSinceCreation > autoLockTimeoutMs) {
        await clearSession()
        setIsLoading(false)
        return
      }

      if (timeSinceCreation > MIN_REFRESH_INTERVAL) {
        try {
          const refreshResponse = await fetchRefreshToken()
          const updatedSession: AuthSession = {
            ...session,
            token: refreshResponse.token,
            expiresAt: refreshResponse.expires_at,
            createdAt: refreshResponse.created_at
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

      setSessionState(session)
      setIsAuthenticated(true)
      setIsLoading(false)
    }

    loadAndRefreshSession()
  }, [clearSession])

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
