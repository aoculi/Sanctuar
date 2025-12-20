import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'

import type { LoginResponse } from '@/api/auth-api'
import { STORAGE_KEYS } from '@/lib/constants'
import { clearStorageItem, getStorageItem, setStorageItem } from '@/lib/storage'

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
    const getSession = async () => {
      const session = await getStorageItem<AuthSession>(STORAGE_KEYS.SESSION)
      if (session) {
        setSessionState(session)
      }
      setIsLoading(false)
    }
    getSession()
  }, [])

  const setSession = useCallback((response: LoginResponse) => {
    const data = {
      userId: response.user_id,
      token: response.token,
      expiresAt: response.expires_at,
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
