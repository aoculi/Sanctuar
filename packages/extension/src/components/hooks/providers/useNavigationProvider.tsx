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
  | '/bookmark'
  | '/settings'
  | '/pin-unlock'
  | '/app'
  | '/tags'

type NavigationOptions = {
  bookmark?: string | null
  tag?: string | null
}

type NavigationContextType = {
  route: Route
  flash: string | null
  selectedBookmark: string | null
  selectedTag: string | null
  navigate: (route: Route, options?: NavigationOptions) => void
  setFlash: (message: string | null) => void
}

export const NavigationContext = createContext<NavigationContextType>({
  route: '/login',
  flash: null,
  selectedBookmark: null,
  selectedTag: null,
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
  const [selectedBookmark, setSelectedBookmark] = useState<string | null>(null)
  const [selectedTag, setSelectedTagState] = useState<string | null>(null)

  const navigate = useCallback(
    (newRoute: Route, options?: NavigationOptions) => {
      setFlashState(null)
      setRoute(newRoute)

      if (options?.bookmark) {
        setSelectedBookmark(options.bookmark)
      } else {
        if (newRoute === '/bookmark') {
          setSelectedBookmark(null)
        }
      }

      if (options?.tag) {
        setSelectedTagState(options.tag)
      } else {
        if (newRoute !== '/app') {
          setSelectedTagState(null)
        }
      }
    },
    []
  )

  const setFlash = useCallback((message: string | null) => {
    setFlashState(message)
  }, [])

  const contextValue: NavigationContextType = {
    route,
    flash,
    selectedBookmark,
    selectedTag,
    navigate,
    setFlash
  }

  return (
    <NavigationContext.Provider value={contextValue}>
      {children}
    </NavigationContext.Provider>
  )
}
