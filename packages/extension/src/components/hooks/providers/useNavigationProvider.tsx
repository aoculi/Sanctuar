import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState
} from 'react'

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

export function NavigationProvider({
  children,
  initialRoute = '/login'
}: NavigationProviderProps) {
  const [route, setRoute] = useState<Route>(initialRoute)
  const [flash, setFlashState] = useState<string | null>(null)

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
