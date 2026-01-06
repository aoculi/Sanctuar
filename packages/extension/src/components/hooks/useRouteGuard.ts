import { useEffect, useRef } from 'react'

import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { useManifest } from '@/components/hooks/providers/useManifestProvider'
import {
  Route,
  useNavigation
} from '@/components/hooks/providers/useNavigationProvider'

const PUBLIC_ROUTES: Route[] = ['/login', '/register', '/settings']
const AUTH_ROUTES: Route[] = ['/login', '/register']

function isPublicRoute(route: Route): boolean {
  return PUBLIC_ROUTES.includes(route)
}

function isAuthRoute(route: Route): boolean {
  return AUTH_ROUTES.includes(route)
}

/**
 * Route guard hook that handles authentication-based redirects
 */
export function useRouteGuard() {
  const { session, isLoading: authLoading, isAuthenticated } = useAuthSession()
  const { manifest, isLoading: manifestLoading } = useManifest()
  const { route, navigate } = useNavigation()
  const initialUserId = useRef<string | null>(null)
  const hasCapturedInitialState = useRef(false)

  useEffect(() => {
    // Capture initial user ID on first check (when popup opens, before auth finishes loading)
    if (!hasCapturedInitialState.current && !authLoading) {
      initialUserId.current = session.userId
      hasCapturedInitialState.current = true
    }

    // Wait for both auth and manifest to finish loading
    if (authLoading || manifestLoading) {
      return
    }

    // Unauthenticated user trying to access protected route → redirect to login
    if (!isAuthenticated && !isPublicRoute(route)) {
      navigate('/login')
      return
    }

    // Authenticated user on auth routes → redirect to main app
    // Only redirect if user was already authenticated when popup opened (not during active login)
    if (isAuthenticated && session.userId && isAuthRoute(route)) {
      const wasAlreadyAuthenticated = initialUserId.current === session.userId

      // Only redirect if user was already authenticated when popup opened
      // This prevents redirecting during active login (which should go to /vault)
      if (wasAlreadyAuthenticated) {
        // If manifest exists, go to bookmark, otherwise go to vault
        const targetRoute = manifest ? '/bookmark' : '/vault'
        navigate(targetRoute)
        return
      }
      // If user just logged in, don't redirect - let explicit navigation handle it
    }
  }, [
    authLoading,
    manifestLoading,
    isAuthenticated,
    session.userId,
    manifest,
    route,
    navigate
  ])
}
