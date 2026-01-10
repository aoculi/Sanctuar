import { TriangleAlert } from 'lucide-react'

import { AuthSessionProvider } from '@/components/hooks/providers/useAuthSessionProvider'
import { ManifestProvider } from '@/components/hooks/providers/useManifestProvider'
import {
  NavigationProvider,
  Route,
  useNavigation
} from '@/components/hooks/providers/useNavigationProvider'
import { SettingsProvider } from '@/components/hooks/providers/useSettingsProvider'
import { UnlockStateProvider } from '@/components/hooks/providers/useUnlockStateProvider'
import { useRouteGuard } from '@/components/hooks/useRouteGuard'

import Bookmark from '@/components/Screens/Bookmark'
import Login from '@/components/Screens/Login'
import PinUnlock from '@/components/Screens/PinUnlock'
import Register from '@/components/Screens/Register'
import Tag from '@/components/Screens/Tag'
import Tags from '@/components/Screens/Tags'
import Vault from '@/components/Screens/Vault'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

function RootContent() {
  useRouteGuard()
  const { route, flash } = useNavigation()

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
