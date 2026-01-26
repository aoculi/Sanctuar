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

import { useBookmarks } from '@/components/hooks/useBookmarks'
import type { Bookmark } from '@/lib/types'

import BookmarkEditModal from '@/components/parts/Bookmarks/BookmarkEditModal'
import BulkActionBar from '@/components/parts/Bookmarks/BulkActionBar'
import CollectionsList from '@/components/parts/Bookmarks/CollectionsList'
import CreateCollection from '@/components/parts/Bookmarks/CreateCollection'
import PinnedList from '@/components/parts/Bookmarks/PinnedList'
import SmartSearch from '@/components/parts/Bookmarks/SmartSearch'
import CollectionTree from '@/components/parts/CollectionTree'
import HiddenToggle from '@/components/parts/HiddenToggle'
import LockMessage from '@/components/parts/LockMessage'
import Settings from '@/components/parts/Settings'
import SmartHeader from '@/components/parts/SmartHeader'
import Tags from '@/components/parts/Tags'
import PinnedTags from '@/components/parts/Tags/PinnedTags'
import TagManageModal from '@/components/parts/Tags/TagManageModal'
import Text from '@/components/ui/Text'
import ThemeToggle from '@/components/parts/ThemeToggle'
import Help from '@/components/parts/Help'

import styles from './styles.module.css'

function AppContent() {
  const { isLoading: authLoading, isAuthenticated } = useAuthSession()
  const {
    isLocked,
    canUnlockWithPin,
    isLoading: unlockLoading
  } = useUnlockState()
  const { isLoading: manifestLoading } = useManifest()
  const { route, selectedTag } = useNavigation()
  const { bookmarks } = useBookmarks()

  const [isAppLoading, setIsAppLoading] = useState(true)
  const initialLoadComplete = useRef(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    if (selectedTag) {
      return [selectedTag]
    }
    const hash = window.location.hash
    if (hash?.startsWith('#tag=')) {
      const tagId = hash.substring(5)
      return tagId ? [tagId] : []
    }
    return []
  })
  const [selectedCollectionId, setSelectedCollectionId] = useState<
    string | null
  >(null)

  // Bookmarks state (moved from Bookmarks component)
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null)
  const [showTagManageModal, setShowTagManageModal] = useState(false)
  const [bookmarkForTags, setBookmarkForTags] = useState<Bookmark | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (initialLoadComplete.current) {
      return
    }

    const allLoaded = !authLoading && !unlockLoading && !manifestLoading

    if (allLoaded) {
      initialLoadComplete.current = true
      setIsAppLoading(false)
    }
  }, [authLoading, unlockLoading, manifestLoading])

  useEffect(() => {
    if (selectedTag) {
      setSelectedTags([selectedTag])
    }
  }, [selectedTag])

  // Handlers (moved from Bookmarks component)
  const handleTagClick = (tagId: string) => {
    setSelectedTags(
      selectedTags.includes(tagId)
        ? selectedTags.filter((id) => id !== tagId)
        : [...selectedTags, tagId]
    )
  }

  const handleManageTags = () => {
    setBookmarkForTags(null)
    setShowTagManageModal(true)
  }

  const handleAddTags = (bookmark: Bookmark) => {
    setBookmarkForTags(bookmark)
    setShowTagManageModal(true)
  }

  const handleTagManageClose = () => {
    setShowTagManageModal(false)
    setBookmarkForTags(null)
  }

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedIds.size === bookmarks.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(bookmarks.map((b: Bookmark) => b.id)))
    }
  }

  const handleClearSelection = () => {
    setSelectedIds(new Set())
  }

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
        return (
          <Tags searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        )
      case '/settings':
        return <Settings />
      case '/help':
        return <Help />
      case '/app':
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
            <>
              {/* Top section - full width */}
              <div className={styles.topSection}>
                <SmartSearch
                  searchQuery={searchQuery}
                  selectedTags={selectedTags}
                  onSearchChange={setSearchQuery}
                  onSelectedTagsChange={setSelectedTags}
                />
                <PinnedTags
                  selectedTags={selectedTags}
                  onTagClick={handleTagClick}
                  onManageTags={handleManageTags}
                />
              </div>

              {/* Two column section */}
              <div className={styles.twoColumns}>
                <div className={styles.sidebar}>
                  <CreateCollection />
                  <CollectionTree
                    selectedCollectionId={selectedCollectionId}
                    onSelectCollection={setSelectedCollectionId}
                  />
                </div>
                <div className={styles.main}>
                  <BulkActionBar
                    totalCount={bookmarks.length}
                    selectedIds={selectedIds}
                    onSelectAll={handleSelectAll}
                    onClearSelection={handleClearSelection}
                  />
                  <PinnedList
                    searchQuery={searchQuery}
                    selectedTags={selectedTags}
                    selectedCollectionId={selectedCollectionId}
                    onEdit={setEditingBookmark}
                    onAddTags={handleAddTags}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                  />
                  <CollectionsList
                    searchQuery={searchQuery}
                    selectedTags={selectedTags}
                    selectedCollectionId={selectedCollectionId}
                    onEdit={setEditingBookmark}
                    onAddTags={handleAddTags}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                  />
                </div>
              </div>

              <BookmarkEditModal
                bookmark={editingBookmark}
                onClose={() => setEditingBookmark(null)}
              />
              <TagManageModal
                open={showTagManageModal}
                onClose={handleTagManageClose}
                bookmark={bookmarkForTags}
              />
            </>
          ) : (
            <div className={styles.main}>{renderContent()}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function App({
  initialRoute = '/app'
}: {
  initialRoute?: Route
}) {
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
