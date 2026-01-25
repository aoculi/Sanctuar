import { TriangleAlert } from 'lucide-react'

import {
  AuthSessionProvider,
  useAuthSession
} from '@/components/hooks/providers/useAuthSessionProvider'
import {
  ManifestProvider,
  useManifest
} from '@/components/hooks/providers/useManifestProvider'
import {
  NavigationProvider,
  Route,
  useNavigation
} from '@/components/hooks/providers/useNavigationProvider'
import { SettingsProvider } from '@/components/hooks/providers/useSettingsProvider'
import {
  UnlockStateProvider,
  useUnlockState
} from '@/components/hooks/providers/useUnlockStateProvider'
import { useRouteGuard } from '@/components/hooks/useRouteGuard'

import Bookmark from '@/components/Screens/Bookmark'
import Login from '@/components/Screens/Login'
import PinUnlock from '@/components/Screens/PinUnlock'
import Register from '@/components/Screens/Register'
import LoadingScreen from '@/components/ui/LoadingScreen'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

function RootContent() {
  useRouteGuard()
  const { route, flash } = useNavigation()
  const { isLoading: authLoading } = useAuthSession()
  const { isLoading: unlockLoading } = useUnlockState()
  const { isLoading: manifestLoading } = useManifest()

  // Don't render anything until we know the auth state
  // This prevents flash of login form when already authenticated
  const isInitializing = authLoading || unlockLoading || manifestLoading

  const renderRoute = () => {
    switch (route as Route) {
      case '/login':
        return <Login />
      case '/register':
        return <Register />
      case '/pin-unlock':
        return <PinUnlock />
      case '/bookmark':
        return <Bookmark />
      default:
        return <Bookmark />
    }
  }

  if (isInitializing) {
    return (
      <div className={styles.container}>
        <LoadingScreen />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {flash && (route !== '/login' && route !== '/register') && (
        <div className={styles.flash}>
          <TriangleAlert size={16} color='white' />
          <Text size='2' weight='regular' color='white'>
            {flash}
          </Text>
        </div>
      )}
      {renderRoute()}
    </div>
  )
}

export default function Root() {
  return (
    <AuthSessionProvider>
      <SettingsProvider>
        <UnlockStateProvider>
          <ManifestProvider>
            <NavigationProvider>
              <RootContent />
            </NavigationProvider>
          </ManifestProvider>
        </UnlockStateProvider>
      </SettingsProvider>
    </AuthSessionProvider>
  )
}
