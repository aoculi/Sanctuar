import { Lock } from 'lucide-react'
import { useState } from 'react'

import {
  AuthSessionProvider,
  useAuthSession
} from '@/components/hooks/providers/useAuthSessionProvider'
import { ManifestProvider } from '@/components/hooks/providers/useManifestProvider'
import { SettingsProvider } from '@/components/hooks/providers/useSettingsProvider'
import {
  UnlockStateProvider,
  useUnlockState
} from '@/components/hooks/providers/useUnlockStateProvider'
import type { Bookmark } from '@/lib/types'

import BookmarkEditModal from '@/components/parts/Bookmarks/BookmarkEditModal'
import CollectionsList from '@/components/parts/CollectionsList'
import CreateCollection from '@/components/parts/CreateCollection'
import PinnedList from '@/components/parts/PinnedList'
import SmartHeader from '@/components/parts/SmartHeader'
import SmartSearch from '@/components/parts/SmartSearch'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

function AppContent() {
  const { isAuthenticated, isLoading } = useAuthSession()
  const {
    isLocked,
    isLoading: unlockLoading,
    canUnlockWithPin
  } = useUnlockState()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null)

  if (isLoading || unlockLoading) {
    return (
      <div className={styles.component}>
        <div className={styles.lockScreen}>
          <div className={styles.lockContent}>
            <div className={styles.lockIconWrapper}>
              <Lock size={32} strokeWidth={1.5} />
            </div>
            <Text size='3' color='light'>
              Loading...
            </Text>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || isLocked) {
    return (
      <div className={styles.component}>
        <div className={styles.lockScreen}>
          <div className={styles.lockContent}>
            <Lock size={32} strokeWidth={1.5} />
            <Text size='4' weight='medium'>
              Your LockMark session is locked.
            </Text>
            <Text size='2' color='light'>
              {canUnlockWithPin
                ? 'Unlock with your PIN to access your bookmarks.'
                : 'Please log in to access your bookmarks.'}
            </Text>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.component}>
      <SmartHeader />
      <div className={styles.content}>
        <div className={styles.container}>
          <SmartSearch
            searchQuery={searchQuery}
            selectedTags={selectedTags}
            onSearchChange={setSearchQuery}
            onSelectedTagsChange={setSelectedTags}
          />
          <PinnedList
            searchQuery={searchQuery}
            selectedTags={selectedTags}
            onEdit={setEditingBookmark}
          />
          <CreateCollection />
          <CollectionsList
            searchQuery={searchQuery}
            selectedTags={selectedTags}
            onEdit={setEditingBookmark}
          />
        </div>
      </div>
      <BookmarkEditModal
        bookmark={editingBookmark}
        onClose={() => setEditingBookmark(null)}
      />
    </div>
  )
}

export default function App() {
  return (
    <AuthSessionProvider>
      <SettingsProvider>
        <UnlockStateProvider>
          <ManifestProvider>
            <AppContent />
          </ManifestProvider>
        </UnlockStateProvider>
      </SettingsProvider>
    </AuthSessionProvider>
  )
}
