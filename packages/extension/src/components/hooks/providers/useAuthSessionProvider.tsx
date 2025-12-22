import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'

import type { LoginResponse } from '@/api/auth-api'
import { fetchRefreshToken } from '@/api/auth-api'
import { MIN_REFRESH_INTERVAL, STORAGE_KEYS } from '@/lib/constants'
import {
  clearStorageItem,
  getSettings,
  getStorageItem,
  parseAutoLockTimeout,
  setStorageItem
} from '@/lib/storage'

export type KdfParams = {
  algo: string
  salt: string
  m: number
  t: number
  p: number
  hkdf_salt?: string | null
}

export type AuthSession = {
  userId: string | null
  token: string | null
  expiresAt: number | null
  createdAt: number | null // When session was created or last refreshed
  kdf: KdfParams | null
  wrappedMk: string | null
}

type AuthSessionContextType = {
  isLoading: boolean
  session: AuthSession
  isAuthenticated: boolean
  setSession: (response: LoginResponse) => void
  clearSession: () => void
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
  setSession: () => {},
  clearSession: () => {}
})

/**
 * Hook to use the auth session context
 * Must be used within an AuthSessionProvider
 */
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

/**
 * Auth Session Provider Component
 * Stores user session and profile data in memory after login
 */
export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  const [session, setSessionState] = useState<AuthSession>(defaultSession)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = session.token !== null && session.userId !== null

  useEffect(() => {
    const loadAndRefreshSession = async () => {
      const session = await getStorageItem<AuthSession>(STORAGE_KEYS.SESSION)

      if (
        !session ||
        !session.token ||
        !session.expiresAt ||
        !session.createdAt
      ) {
        setIsLoading(false)
        return
      }

      const now = Date.now()
      const timeUntilExpiry = session.expiresAt - now

      // Token has expired - clear session
      if (timeUntilExpiry <= 0) {
        clearSession()
        setIsLoading(false)
        return
      }

      // Get autoLockTimeout from settings
      const settings = await getSettings()
      const autoLockTimeoutMs = settings
        ? parseAutoLockTimeout(settings.autoLockTimeout)
        : MIN_REFRESH_INTERVAL

      // Calculate time since session was created/refreshed
      const sessionCreatedAt = session.createdAt
      const timeSinceCreation = now - sessionCreatedAt

      // If session was created/refreshed longer ago than autoLockTimeout, clear it
      // (even if token is still technically valid)
      if (timeSinceCreation > autoLockTimeoutMs) {
        clearSession()
        setIsLoading(false)
        return
      }

      // If token was is created more than MIN_REFRESH_INTERVAL minute ago, refresh it proactively
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
          await setStorageItem(STORAGE_KEYS.SESSION, updatedSession)
          setIsLoading(false)
          return
        } catch (error) {
          // Refresh failed but token not expired yet - keep session (lenient approach)
          console.warn('Token refresh failed, using existing session:', error)
        }
      }

      // Session is valid (either no refresh needed, or refresh failed but token still valid)
      setSessionState(session)
      setIsLoading(false)
    }

    loadAndRefreshSession()
  }, [])

  const setSession = useCallback((response: LoginResponse) => {
    const data: AuthSession = {
      userId: response.user_id,
      token: response.token,
      expiresAt: response.expires_at,
      createdAt: response.created_at,
      kdf: response.kdf,
      wrappedMk: response.wrapped_mk
    }

    // Update React state
    setSessionState(data)

    // Sync to chrome.storage.local so api.ts can access the token
    setStorageItem(STORAGE_KEYS.SESSION, data)
  }, [])

  const clearSession = useCallback(() => {
    setSessionState(defaultSession)
    clearStorageItem(STORAGE_KEYS.SESSION)
    clearStorageItem(STORAGE_KEYS.KEYSTORE)
    clearStorageItem(STORAGE_KEYS.MANIFEST)
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
