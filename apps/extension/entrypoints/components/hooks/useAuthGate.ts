import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

import { useSession } from '@/entrypoints/components/hooks/auth'
import { keystoreManager } from '@/entrypoints/store/keystore'
import { sessionManager } from '@/entrypoints/store/session'
import { settingsStore } from '@/entrypoints/store/settings'

import { type Route } from './useNavigation'

export type UseAuthGateResult = {
  route: Route
  isChecking: boolean
  flash: string | null
  isSettingsOpen: boolean
  navigate: (route: Route) => void
  setRoute: Dispatch<SetStateAction<Route>>
  setFlash: Dispatch<SetStateAction<string | null>>
  setIsSettingsOpen: Dispatch<SetStateAction<boolean>>
  openSettings: () => void
  handleLoginSuccess: () => void
  handleRegisterSuccess: () => void
}

/**
 * Handles initial session/keystore validation for the extension popup.
 * Keeps Screens lean by encapsulating side effects and state transitions.
 */
export function useAuthGate(): UseAuthGateResult {
  const [route, setRoute] = useState<Route>('/login')
  const [flash, setFlash] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const sessionQuery = useSession()
  const refetchSession = sessionQuery.refetch

  useEffect(() => {
    let cancelled = false

    const checkSession = async () => {
      try {
        const settings = await settingsStore.getState()
        if (!settings.apiUrl || settings.apiUrl.trim() === '') {
          if (!cancelled) {
            setIsSettingsOpen(true)
          }
        }

        const [session, isUnlocked] = await Promise.all([
          sessionManager.getSession(),
          keystoreManager.isUnlocked()
        ])

        if (!isUnlocked) {
          if (!cancelled) {
            setRoute('/login')
          }
          return
        }

        if (session) {
          const sessionData = await refetchSession()
          if (sessionData.data?.valid) {
            if (!cancelled) {
              setRoute('/vault')
            }
          } else {
            await sessionManager.clearSession()
            if (!cancelled) {
              setRoute('/login')
              setFlash('Session expired')
            }
          }
        } else if (!cancelled) {
          setRoute('/login')
        }
      } catch (error: any) {
        if (error?.status === -1 && error?.message?.includes('API URL')) {
          if (!cancelled) {
            setFlash(error.message)
            setIsSettingsOpen(true)
          }
        } else {
          console.error('Session check failed:', error)
          await sessionManager.clearSession()
          if (!cancelled) {
            setRoute('/login')
            setFlash('Session check failed')
          }
        }
      } finally {
        if (!cancelled) {
          setIsChecking(false)
        }
      }
    }

    void checkSession()

    return () => {
      cancelled = true
    }
  }, [refetchSession])

  const navigate = (newRoute: Route) => {
    setRoute(newRoute)
  }

  const openSettings = () => {
    setIsSettingsOpen(true)
  }

  const handleLoginSuccess = () => {
    setFlash(null)
    setRoute('/vault')
  }

  const handleRegisterSuccess = () => {
    setFlash(null)
    setRoute('/vault')
  }

  return {
    route,
    isChecking,
    flash,
    isSettingsOpen,
    navigate,
    setRoute,
    setFlash,
    setIsSettingsOpen,
    openSettings,
    handleLoginSuccess,
    handleRegisterSuccess
  }
}
