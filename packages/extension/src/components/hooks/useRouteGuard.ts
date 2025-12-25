import { useEffect } from 'react'

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
  const { session, isLoading: authLoading } = useAuthSession()
  const { manifest, isLoading: manifestLoading } = useManifest()
  const { route, navigate } = useNavigation()

  useEffect(() => {
    // Wait for both auth and manifest to finish loading
    if (authLoading || manifestLoading) return

    // Unauthenticated user trying to access protected route → redirect to login
    if (!session.userId && !isPublicRoute(route)) {
      navigate('/login')
      return
    }

    // Authenticated user with manifest on auth routes → redirect to main app
    if (session.userId && manifest && isAuthRoute(route)) {
      navigate('/bookmark')
      return
    }
  }, [authLoading, manifestLoading, session.userId, manifest, route, navigate])
}
