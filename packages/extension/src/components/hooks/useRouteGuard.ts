import { useEffect, useRef } from 'react'

import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { useManifest } from '@/components/hooks/providers/useManifestProvider'
import {
  Route,
  useNavigation
} from '@/components/hooks/providers/useNavigationProvider'
import { useUnlockState } from '@/components/hooks/providers/useUnlockStateProvider'

const PUBLIC_ROUTES: Route[] = [
  '/login',
  '/register',
  '/settings',
  '/pin-unlock'
]
const AUTH_ROUTES: Route[] = ['/login', '/register']

function isPublicRoute(route: Route): boolean {
  return PUBLIC_ROUTES.includes(route)
}

function isAuthRoute(route: Route): boolean {
  return AUTH_ROUTES.includes(route)
}

export function useRouteGuard() {
  const { session, isLoading: authLoading, isAuthenticated } = useAuthSession()
  const {
    unlockState,
    isLoading: unlockLoading,
    canUnlockWithPin
  } = useUnlockState()
  const { manifest, isLoading: manifestLoading } = useManifest()
  const { route, navigate } = useNavigation()
  const initialUserId = useRef<string | null>(null)
  const hasCapturedInitialState = useRef(false)

  useEffect(() => {
    if (!hasCapturedInitialState.current && !authLoading) {
      initialUserId.current = session.userId
      hasCapturedInitialState.current = true
    }

    if (authLoading || unlockLoading || manifestLoading) {
      return
    }

    if (!isAuthenticated) {
      if (!isPublicRoute(route)) {
        navigate('/login')
      }
      return
    }

    if (unlockState === 'locked') {
      // If user is on an auth route (login/register), let them stay there
      // This handles two cases:
      // 1. User chose to use password authentication instead of PIN
      // 2. Race condition during login/register flow when keystore isn't set yet
      //    but session is already authenticated
      if (isAuthRoute(route)) {
        return
      }
      if (canUnlockWithPin && route !== '/pin-unlock') {
        navigate('/pin-unlock')
      } else if (!canUnlockWithPin) {
        navigate('/login')
      }
      return
    }

    if (unlockState === 'unlocked' && isAuthRoute(route)) {
      const wasAlreadyAuthenticated = initialUserId.current === session.userId
      if (wasAlreadyAuthenticated) {
        const targetRoute = '/bookmark'
        navigate(targetRoute)
      }
    }
  }, [
    authLoading,
    unlockLoading,
    manifestLoading,
    isAuthenticated,
    unlockState,
    canUnlockWithPin,
    session.userId,
    manifest,
    route,
    navigate
  ])
}
