import { useEffect, useRef, useState } from 'react'

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
import { useLockTimerReset } from '@/components/hooks/useLockTimerReset'

import BookmarksView from '@/components/parts/BookmarksView'
import Help from '@/components/parts/Help'
import HiddenToggle from '@/components/parts/HiddenToggle'
import LockMessage from '@/components/parts/LockMessage'
import Settings from '@/components/parts/Settings'
import SmartHeader from '@/components/parts/SmartHeader'
import Tags from '@/components/parts/Tags'
import ThemeToggle from '@/components/parts/ThemeToggle'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

function getInitialTags(selectedTag: string | null): string[] {
  if (selectedTag) {
    return [selectedTag]
  }
  const hash = window.location.hash
  if (hash?.startsWith('#tag=')) {
    const tagId = hash.substring(5)
    return tagId ? [tagId] : []
  }
  return []
}

function AppContent() {
  const { isLoading: authLoading, isAuthenticated } = useAuthSession()
  const { isLocked, canUnlockWithPin, isLoading: unlockLoading } = useUnlockState()
  const { isLoading: manifestLoading } = useManifest()
  const { route, selectedTag } = useNavigation()

  const [isAppLoading, setIsAppLoading] = useState(true)
  const initialLoadComplete = useRef(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>(() =>
    getInitialTags(selectedTag)
  )

  // Reset lock timer on user interaction
  useLockTimerReset()

  // Track initial loading state
  useEffect(() => {
    if (initialLoadComplete.current) return

    const allLoaded = !authLoading && !unlockLoading && !manifestLoading
    if (allLoaded) {
      initialLoadComplete.current = true
      setIsAppLoading(false)
    }
  }, [authLoading, unlockLoading, manifestLoading])

  // Sync selectedTag from navigation
  useEffect(() => {
    if (selectedTag) {
      setSelectedTags([selectedTag])
    }
  }, [selectedTag])

  if (isAppLoading) {
    return (
      <div className={styles.component}>
        <div className={styles.loading}>
          <Text size='3' color='light'>
            Loading...
          </Text>
        </div>
      </div>
    )
  }

  if ((!isAuthenticated || isLocked) && route !== '/settings') {
    return <LockMessage canUnlockWithPin={canUnlockWithPin} />
  }

  const isBookmarksRoute = route === '/app' || route === undefined

  const renderContent = () => {
    switch (route) {
      case '/tags':
        return <Tags searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      case '/settings':
        return <Settings />
      case '/help':
        return <Help />
      default:
        return null
    }
  }

  return (
    <div className={styles.component}>
      <div className={styles.header}>
        <SmartHeader />
        <div className={styles.headerToggles}>
          <HiddenToggle />
          <ThemeToggle />
        </div>
      </div>
      <div className={styles.content}>
        <div className={styles.container}>
          {isBookmarksRoute ? (
            <BookmarksView
              searchQuery={searchQuery}
              selectedTags={selectedTags}
              onSearchChange={setSearchQuery}
              onSelectedTagsChange={setSelectedTags}
            />
          ) : (
            <div className={styles.main}>{renderContent()}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function App({ initialRoute = '/app' }: { initialRoute?: Route }) {
  return (
    <AuthSessionProvider>
      <SettingsProvider>
        <UnlockStateProvider>
          <ManifestProvider>
            <NavigationProvider initialRoute={initialRoute}>
              <AppContent />
            </NavigationProvider>
          </ManifestProvider>
        </UnlockStateProvider>
      </SettingsProvider>
    </AuthSessionProvider>
  )
}
