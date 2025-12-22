import { AuthSessionProvider } from '@/components/hooks/providers/useAuthSessionProvider'
import {
  NavigationProvider,
  Route,
  useNavigation
} from '@/components/hooks/providers/useNavigationProvider'
import { SettingsProvider } from '@/components/hooks/providers/useSettingsProvider'

import Text from '@/components/ui/Text'
import Bookmark from '../Bookmark'
import Login from '../Login'
import Register from '../Register'
import Settings from '../Settings'
import Tag from '../Tag'
import Vault from '../Vault'

import styles from './styles.module.css'

function RootContent() {
  const { route, flash, setFlash, navigate } = useNavigation()
  const [selectedBookmark, setSelectedBookmark] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  useEffect(() => {
    if (selectedTag) {
      navigate('/tag')
    }
  }, [selectedTag])

  useEffect(() => {
    if (selectedBookmark) {
      navigate('/bookmark')
    }
  }, [selectedBookmark])

  const handleLoginSuccess = () => {
    setFlash(null)
    navigate('/bookmark')
  }

  const handleRegisterSuccess = () => {
    setFlash(null)
    navigate('/bookmark')
  }

  const renderRoute = () => {
    switch (route as Route) {
      case '/login':
        return <Login onLoginSuccess={handleLoginSuccess} />
      case '/register':
        return <Register onRegisterSuccess={handleRegisterSuccess} />
      case '/settings':
        return <Settings />
      case '/vault':
        return (
          <Vault
            setSelectedBookmark={setSelectedBookmark}
            setSelectedTag={setSelectedTag}
          />
        )
      case '/bookmark':
        return <Bookmark id={selectedBookmark} />
      case '/tag':
        return <Tag id={selectedTag} />
      default:
        return <Bookmark id={selectedBookmark} />
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
        <NavigationProvider>
          <RootContent />
        </NavigationProvider>
      </AuthSessionProvider>
    </SettingsProvider>
  )
}
