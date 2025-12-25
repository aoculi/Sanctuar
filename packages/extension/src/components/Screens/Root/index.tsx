import { AuthSessionProvider } from '@/components/hooks/providers/useAuthSessionProvider'
import { ManifestProvider } from '@/components/hooks/providers/useManifestProvider'
import {
  NavigationProvider,
  Route,
  useNavigation
} from '@/components/hooks/providers/useNavigationProvider'
import { SelectionProvider } from '@/components/hooks/providers/useSelectionProvider'
import { SettingsProvider } from '@/components/hooks/providers/useSettingsProvider'

import Bookmark from '@/components/Screens/Bookmark'
import Login from '@/components/Screens/Login'
import Register from '@/components/Screens/Register'
import Settings from '@/components/Screens/Settings'
import Tag from '@/components/Screens/Tag'
import Vault from '@/components/Screens/Vault'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

function RootContent() {
  const { route, flash } = useNavigation()

  const renderRoute = () => {
    switch (route as Route) {
      case '/login':
        return <Login />
      case '/register':
        return <Register />
      case '/settings':
        return <Settings />
      case '/vault':
        return <Vault />
      case '/bookmark':
        return <Bookmark />
      case '/tag':
        return <Tag />
      default:
        return <Bookmark />
    }
  }

  return (
    <>
      {flash && (
        <div className={styles.flash}>
          <Text align='center' size='2' weight='regular' color='light'>
            {flash}
          </Text>
        </div>
      )}
      {renderRoute()}
    </>
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
            <SelectionProvider>
              <RootContent />
            </SelectionProvider>
          </NavigationProvider>
        </ManifestProvider>
      </AuthSessionProvider>
    </SettingsProvider>
  )
}
