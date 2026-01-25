import { useEffect, useMemo, useRef, useState } from 'react'

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
import { SettingsProvider, useSettings } from '@/components/hooks/providers/useSettingsProvider'
import {
  UnlockStateProvider,
  useUnlockState
} from '@/components/hooks/providers/useUnlockStateProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useTags } from '@/components/hooks/useTags'
import { filterBookmarks } from '@/lib/bookmarkUtils'
import type { Bookmark } from '@/lib/types'

import BookmarkEditModal from '@/components/parts/Bookmarks/BookmarkEditModal'
import BookmarkRow from '@/components/parts/Bookmarks/BookmarkRow'
import BulkActionBar from '@/components/parts/Bookmarks/BulkActionBar'
import SmartSearch from '@/components/parts/Bookmarks/SmartSearch'
import Help from '@/components/parts/Help'
import LockMessage from '@/components/parts/LockMessage'
import Settings from '@/components/parts/Settings'
import Sidebar from '@/components/parts/Sidebar'
import Tags from '@/components/parts/Tags'
import TagManageModal from '@/components/parts/Tags/TagManageModal'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

function AppContent() {
  const { isLoading: authLoading, isAuthenticated } = useAuthSession()
  const {
    isLocked,
    canUnlockWithPin,
    isLoading: unlockLoading
  } = useUnlockState()
  const { isLoading: manifestLoading } = useManifest()
  const { route, selectedTag, setFlash } = useNavigation()
  const { bookmarks, updateBookmark, deleteBookmark } = useBookmarks()
  const { tags } = useTags()
  const { settings } = useSettings()

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
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null)
  const [showTagManageModal, setShowTagManageModal] = useState(false)
  const [bookmarkForTags, setBookmarkForTags] = useState<Bookmark | null>(null)

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

  // Filter bookmarks based on selection
  const filteredBookmarks = useMemo(() => {
    let filtered = [...bookmarks]

    // Filter by hidden setting
    if (!settings.showHiddenBookmarks) {
      filtered = filtered.filter((b) => !b.hidden)
    }

    // Filter by collection
    if (selectedCollectionId === 'uncategorized') {
      filtered = filtered.filter((b: Bookmark) => !b.collectionId && !b.pinned)
    } else if (selectedCollectionId) {
      filtered = filtered.filter((b: Bookmark) => b.collectionId === selectedCollectionId)
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filterBookmarks(filtered, tags, searchQuery)
    }

    // Apply tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter((bookmark) =>
        selectedTags.some((tagId) => bookmark.tags.includes(tagId))
      )
    }

    // Sort by updated_at
    return filtered.sort((a: Bookmark, b: Bookmark) => b.updated_at - a.updated_at)
  }, [bookmarks, selectedCollectionId, searchQuery, selectedTags, tags, settings.showHiddenBookmarks])

  const handleSelectTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  const handleTogglePin = async (bookmark: Bookmark) => {
    try {
      await updateBookmark(bookmark.id, { pinned: !bookmark.pinned })
    } catch (error) {
      setFlash(`Failed to update bookmark: ${(error as Error).message}`)
      setTimeout(() => setFlash(null), 5000)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this bookmark?')) {
      try {
        await deleteBookmark(id)
      } catch (error) {
        setFlash(`Failed to delete bookmark: ${(error as Error).message}`)
        setTimeout(() => setFlash(null), 5000)
      }
    }
  }

  const handleAddTags = (bookmark: Bookmark) => {
    setBookmarkForTags(bookmark)
    setShowTagManageModal(true)
  }

  const handleManageTags = () => {
    setBookmarkForTags(null)
    setShowTagManageModal(true)
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
    if (selectedIds.size === filteredBookmarks.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredBookmarks.map((b: Bookmark) => b.id)))
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

  // Full page routes (no sidebar)
  if (route === '/tags') {
    return (
      <div className={styles.component}>
        <div className={styles.fullPage}>
          <Tags searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        </div>
      </div>
    )
  }

  if (route === '/settings') {
    return (
      <div className={styles.component}>
        <div className={styles.fullPage}>
          <Settings />
        </div>
      </div>
    )
  }

  if (route === '/help') {
    return (
      <div className={styles.component}>
        <div className={styles.fullPage}>
          <Help />
        </div>
      </div>
    )
  }

  // Main app with sidebar
  return (
    <div className={styles.component}>
      <Sidebar
        selectedCollectionId={selectedCollectionId}
        selectedTagIds={selectedTags}
        onSelectCollection={setSelectedCollectionId}
        onSelectTag={handleSelectTag}
        onManageTags={handleManageTags}
      />

      <main className={styles.main}>
        <header className={styles.header}>
          <SmartSearch
            searchQuery={searchQuery}
            selectedTags={selectedTags}
            onSearchChange={setSearchQuery}
            onSelectedTagsChange={setSelectedTags}
          />
        </header>

        <div className={styles.toolbar}>
          <BulkActionBar
            totalCount={filteredBookmarks.length}
            selectedIds={selectedIds}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
          />
        </div>

        <div className={styles.content}>
          {filteredBookmarks.length === 0 ? (
            <div className={styles.empty}>
              <Text size='2' color='light'>
                {searchQuery || selectedTags.length > 0
                  ? 'No bookmarks match your filters'
                  : 'No bookmarks yet'}
              </Text>
            </div>
          ) : (
            <div className={styles.list}>
              {filteredBookmarks.map((bookmark: Bookmark) => (
                <BookmarkRow
                  key={bookmark.id}
                  bookmark={bookmark}
                  tags={tags}
                  onTogglePin={() => handleTogglePin(bookmark)}
                  onEdit={() => setEditingBookmark(bookmark)}
                  onDelete={() => handleDelete(bookmark.id)}
                  onAddTags={() => handleAddTags(bookmark)}
                  selected={selectedIds.has(bookmark.id)}
                  onToggleSelect={() => handleToggleSelect(bookmark.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <BookmarkEditModal
        bookmark={editingBookmark}
        onClose={() => setEditingBookmark(null)}
      />
      <TagManageModal
        open={showTagManageModal}
        onClose={() => {
          setShowTagManageModal(false)
          setBookmarkForTags(null)
        }}
        bookmark={bookmarkForTags}
      />
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
