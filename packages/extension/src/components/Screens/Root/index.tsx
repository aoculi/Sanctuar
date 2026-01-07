import { TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'

import {
  AuthSessionProvider,
  useAuthSession
} from '@/components/hooks/providers/useAuthSessionProvider'
import { ManifestProvider } from '@/components/hooks/providers/useManifestProvider'
import {
  NavigationProvider,
  Route,
  useNavigation
} from '@/components/hooks/providers/useNavigationProvider'
import { SettingsProvider } from '@/components/hooks/providers/useSettingsProvider'
import { useRouteGuard } from '@/components/hooks/useRouteGuard'
import Bookmark from '@/components/Screens/Bookmark'
import Collection from '@/components/Screens/Collection'
import Collections from '@/components/Screens/Collections'
import Login from '@/components/Screens/Login'
import PinUnlock from '@/components/Screens/PinUnlock'
import Register from '@/components/Screens/Register'
import Tag from '@/components/Screens/Tag'
import Tags from '@/components/Screens/Tags'
import Vault from '@/components/Screens/Vault'
import Text from '@/components/ui/Text'
import { STORAGE_KEYS } from '@/lib/constants'
import { getSettings, getStorageItem } from '@/lib/storage'

import styles from './styles.module.css'

function RootContent() {
  useRouteGuard()
  const { route, flash, navigate } = useNavigation()
  const { session } = useAuthSession()

  useEffect(() => {
    const checkLockState = async () => {
      // Don't redirect during authentication flows
      if (route === '/login' || route === '/register' || route === '/pin-unlock') {
        return
      }

      // Check if session exists but keystore is missing (soft lock)
      if (session.userId && session.token) {
        const keystore = await getStorageItem(STORAGE_KEYS.KEYSTORE)
        const settings = await getSettings()

        if (!keystore && settings?.unlockMethod === 'pin') {
          navigate('/pin-unlock')
        }
      }
    }

    checkLockState()
  }, [session.userId, session.token, route, navigate])

  const renderRoute = () => {
    switch (route as Route) {
      case '/login':
        return <Login />
      case '/register':
        return <Register />
      case '/pin-unlock':
        return <PinUnlock />
      case '/vault':
        return <Vault />
      case '/bookmark':
        return <Bookmark />
      case '/tag':
        return <Tag />
      case '/tags':
        return <Tags />
      case '/collection':
        return <Collection />
      case '/collections':
        return <Collections />
      default:
        return <Bookmark />
    }
  }

  return (
    <div className={styles.container}>
      {flash && (
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

/**
 * Root component that sets up all providers
 */
export default function Root() {
  return (
    <SettingsProvider>
      <AuthSessionProvider>
        <ManifestProvider>
          <NavigationProvider>
            <RootContent />
          </NavigationProvider>
        </ManifestProvider>
      </AuthSessionProvider>
    </SettingsProvider>
  )
}
