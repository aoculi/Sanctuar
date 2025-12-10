import { createContext, useContext } from 'react'

export type Route = '/login' | '/register' | '/vault'

type NavigationContextType = {
  navigate: (route: Route) => void
  setFlash: (message: string | null) => void
  openSettings: () => void
}

export const NavigationContext = createContext<NavigationContextType | null>(
  null
)

export const useNavigation = () => {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within Screens')
  }
  return context
}
