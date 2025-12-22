import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'

import { loadManifestData } from '@/components/hooks/useManifest'
import { useAuthSession } from './useAuthSessionProvider'

export type Route =
  | '/login'
  | '/register'
  | '/vault'
  | '/bookmark'
  | '/tag'
  | '/settings'

type NavigationContextType = {
  route: Route
  flash: string | null
  navigate: (route: Route) => void
  setFlash: (message: string | null) => void
}

export const NavigationContext = createContext<NavigationContextType>({
  route: '/login',
  flash: null,
  navigate: () => {},
  setFlash: () => {}
})

/**
 * Hook to use the navigation context
 * Must be used within a NavigationProvider
 */
export const useNavigation = () => {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider')
  }

  return context
}

type NavigationProviderProps = {
  children: ReactNode
  initialRoute?: Route
}

/**
 * Navigation Provider Component
 * Provides navigation, flash messages, and settings modal state to children
 */
export function NavigationProvider({
  children,
  initialRoute = '/login'
}: NavigationProviderProps) {
  const [route, setRoute] = useState<Route>(initialRoute)
  const [flash, setFlashState] = useState<string | null>(null)

  const { session, isLoading } = useAuthSession()

  // Auto-redirect to login if session is cleared (logout)
  // Note: Navigation TO vault is handled explicitly by Login/Register onSuccess
  useEffect(() => {
    if (isLoading) return

    if (
      !session.userId &&
      route !== '/login' &&
      route !== '/register' &&
      route !== '/settings'
    ) {
      setRoute('/login')
      return
    }

    const checkManifest = async () => {
      const data = await loadManifestData()

      // has session and manifest
      if (session.userId && data?.manifest) {
        if (route === '/login' || route === '/register') {
          setRoute('/bookmark')
          return
        }
      }
    }
    checkManifest()
  }, [isLoading, session.userId, route])

  const navigate = useCallback((newRoute: Route) => {
    setRoute(newRoute)
  }, [])

  const setFlash = useCallback((message: string | null) => {
    setFlashState(message)
  }, [])

  const contextValue: NavigationContextType = {
    route,
    flash,
    navigate,
    setFlash
  }

  return (
    <NavigationContext.Provider value={contextValue}>
      {children}
    </NavigationContext.Provider>
  )
}
