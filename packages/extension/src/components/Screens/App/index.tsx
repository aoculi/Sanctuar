import { useState } from 'react'

import { AuthSessionProvider } from '@/components/hooks/providers/useAuthSessionProvider'
import { ManifestProvider } from '@/components/hooks/providers/useManifestProvider'
import { SettingsProvider } from '@/components/hooks/providers/useSettingsProvider'
import { UnlockStateProvider } from '@/components/hooks/providers/useUnlockStateProvider'
import type { Bookmark } from '@/lib/types'

import BookmarkEditModal from '@/components/parts/Bookmarks/BookmarkEditModal'
import CollectionsList from '@/components/parts/CollectionsList'
import CreateCollection from '@/components/parts/CreateCollection'
import PinnedList from '@/components/parts/PinnedList'
import SmartHeader from '@/components/parts/SmartHeader'
import SmartSearch from '@/components/parts/SmartSearch'

import styles from './styles.module.css'

function AppContent() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null)

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
