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
  | '/tags'
  | '/collection'
  | '/collections'
  | '/settings'
  | '/pin-unlock'

type NavigationOptions = {
  bookmark?: string | null
  tag?: string | null
  collection?: string | null
}

type NavigationContextType = {
  route: Route
  flash: string | null
  selectedBookmark: string | null
  selectedTag: string | null
  selectedCollection: string | null
  navigate: (route: Route, options?: NavigationOptions) => void
  setFlash: (message: string | null) => void
}

export const NavigationContext = createContext<NavigationContextType>({
  route: '/login',
  flash: null,
  selectedBookmark: null,
  selectedTag: null,
  selectedCollection: null,
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
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [selectedCollection, setSelectedCollection] = useState<string | null>(
    null
  )

  const navigate = useCallback(
    (newRoute: Route, options?: NavigationOptions) => {
      setFlashState(null)
      setRoute(newRoute)

      if (options?.bookmark) {
        setSelectedBookmark(options.bookmark)
        setSelectedTag(null)
        setSelectedCollection(null)
      } else if (options?.tag) {
        setSelectedTag(options.tag)
        setSelectedBookmark(null)
        setSelectedCollection(null)
      } else if (options?.collection) {
        setSelectedCollection(options.collection)
        setSelectedBookmark(null)
        setSelectedTag(null)
      } else {
        // When no options provided, reset selection based on route to match current behavior
        if (newRoute === '/bookmark') {
          setSelectedBookmark(null)
        } else if (newRoute === '/tag') {
          setSelectedTag(null)
        } else if (newRoute === '/tags') {
          setSelectedTag(null)
        } else if (newRoute === '/collection') {
          setSelectedCollection(null)
        } else if (newRoute === '/collections') {
          setSelectedCollection(null)
        } else if (newRoute === '/vault') {
          setSelectedBookmark(null)
          setSelectedTag(null)
          setSelectedCollection(null)
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
    selectedCollection,
    navigate,
    setFlash
  }

  return (
    <NavigationContext.Provider value={contextValue}>
      {children}
    </NavigationContext.Provider>
  )
}
