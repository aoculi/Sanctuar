import { ChevronDown, ChevronRight, Folder, Inbox } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useManifest } from '@/components/hooks/providers/useManifestProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useTags } from '@/components/hooks/useTags'
import { getIconByName } from '@/components/ui/IconPicker'
import { processBookmarks } from '@/lib/bookmarkUtils'
import {
  flattenCollectionsWithBookmarks,
  getBookmarkIdsInCollections
} from '@/lib/collectionUtils'
import type { Bookmark } from '@/lib/types'

import { BookmarkCard } from '@/components/parts/Bookmarks/BookmarkCard'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

type Props = {
  searchQuery: string
  currentTagId: string | null
  sortMode: 'updated_at' | 'title'
  selectedTags: string[]
  selectedBookmarkIds: Set<string>
  onSelectedBookmarkIdsChange: (ids: Set<string>) => void
}

export default function BookmarkList({
  searchQuery,
  currentTagId,
  sortMode,
  selectedTags,
  selectedBookmarkIds,
  onSelectedBookmarkIdsChange
}: Props) {
  const { bookmarks, deleteBookmark } = useBookmarks()
  const { tags, showHiddenTags } = useTags()
  const { setFlash } = useNavigation()
  const { manifest } = useManifest()

  const onDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this bookmark?')) {
      try {
        await deleteBookmark(id)
      } catch (error) {
        setFlash(
          'Failed to delete bookmark: ' +
            ((error as Error).message ?? 'Unknown error')
        )

        setTimeout(() => setFlash(null), 5000)
      }
    }
  }

  const handleBookmarkToggle = (id: string) => {
    const newSelected = new Set(selectedBookmarkIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    onSelectedBookmarkIdsChange(newSelected)
  }

  // Process bookmarks: filter and sort
  const { visibleBookmarks, pinnedBookmarks, nonPinnedBookmarks } = useMemo(
    () =>
      processBookmarks(bookmarks, tags, {
        searchQuery,
        selectedTags,
        sortMode,
        showHiddenTags,
        currentTagId
      }),
    [
      bookmarks,
      tags,
      searchQuery,
      selectedTags,
      sortMode,
      showHiddenTags,
      currentTagId
    ]
  )

  // Get collections
  const collections = manifest?.collections || []

  // Track which collections are expanded (all collapsed by default)
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(
    new Set()
  )

  const toggleCollapse = (collectionId: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev)
      if (next.has(collectionId)) {
        next.delete(collectionId)
      } else {
        next.add(collectionId)
      }
      return next
    })
  }

  // Group bookmarks by collection and build tree structure
  const collectionsWithBookmarks = useMemo(
    () =>
      flattenCollectionsWithBookmarks(
        collections,
        nonPinnedBookmarks,
        sortMode
      ),
    [collections, nonPinnedBookmarks, sortMode]
  )

  // Get IDs of bookmarks that belong to any collection
  const bookmarkIdsInCollections = useMemo(
    () => getBookmarkIdsInCollections(collectionsWithBookmarks),
    [collectionsWithBookmarks]
  )

  // Bookmarks not in any collection
  const uncategorizedBookmarks = useMemo(
    () =>
      nonPinnedBookmarks.filter(
        (bookmark) => !bookmarkIdsInCollections.has(bookmark.id)
      ),
    [nonPinnedBookmarks, bookmarkIdsInCollections]
  )

  // Virtual collection ID for uncategorized bookmarks
  const UNCATEGORIZED_ID = '__uncategorized__'

  // Check if a collection should be hidden (any ancestor is collapsed)
  const isHiddenByParent = (collectionId: string): boolean => {
    const collection = collections.find((c) => c.id === collectionId)
    if (!collection?.parentId) return false
    if (!expandedCollections.has(collection.parentId)) return true
    return isHiddenByParent(collection.parentId)
  }

  return (
    <div className={styles.container}>
      {visibleBookmarks.length === 0 ? (
        <Text size='2' color='light' style={{ padding: '20px 20px 0' }}>
          {bookmarks.length === 0
            ? 'No bookmarks yet. Click "Add Bookmark" to get started.'
            : 'No visible bookmarks. Enable hidden tags in settings or add new bookmarks.'}
        </Text>
      ) : pinnedBookmarks.length === 0 && nonPinnedBookmarks.length === 0 ? (
        <Text size='2' color='light' style={{ padding: '20px 20px 0' }}>
          No bookmarks match your search.
        </Text>
      ) : (
        <div className={styles.list}>
          {pinnedBookmarks.map((bookmark: Bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              tags={tags}
              onDelete={onDelete}
              isSelected={selectedBookmarkIds.has(bookmark.id)}
              onToggleSelect={() => handleBookmarkToggle(bookmark.id)}
            />
          ))}
          {pinnedBookmarks.length > 0 &&
            (nonPinnedBookmarks.length > 0 ||
              collectionsWithBookmarks.length > 0) && (
              <div className={styles.separator} />
            )}
          {collectionsWithBookmarks.map(
            ({ collection, bookmarks: collectionBookmarks, depth }) => {
              // Skip if this collection's parent is collapsed
              if (isHiddenByParent(collection.id)) return null

              const Icon = collection.icon
                ? getIconByName(collection.icon)
                : Folder
              const isExpanded = expandedCollections.has(collection.id)
              const ChevronIcon = isExpanded ? ChevronDown : ChevronRight

              return (
                <div key={collection.id} className={styles.collectionGroup}>
                  <button
                    type='button'
                    className={styles.collectionHeader}
                    style={{ paddingLeft: `${depth * 20 + 12}px` }}
                    onClick={() => toggleCollapse(collection.id)}
                  >
                    <ChevronIcon size={14} />
                    <Icon size={16} className={styles.collectionIcon} />
                    <Text size='2' weight='medium' color='light'>
                      {collection.name}
                      {collectionBookmarks.length > 0 && (
                        <span style={{ marginLeft: '8px', opacity: 0.7 }}>
                          ({collectionBookmarks.length})
                        </span>
                      )}
                    </Text>
                  </button>
                  {isExpanded &&
                    collectionBookmarks.length > 0 &&
                    collectionBookmarks.map((bookmark: Bookmark) => (
                      <BookmarkCard
                        key={bookmark.id}
                        bookmark={bookmark}
                        tags={tags}
                        onDelete={onDelete}
                        isSelected={selectedBookmarkIds.has(bookmark.id)}
                        onToggleSelect={() => handleBookmarkToggle(bookmark.id)}
                      />
                    ))}
                </div>
              )
            }
          )}
          {/* Virtual collection for bookmarks not in any collection */}
          {uncategorizedBookmarks.length > 0 && (
            <div className={styles.collectionGroup}>
              <button
                type='button'
                className={styles.collectionHeader}
                style={{ paddingLeft: '12px' }}
                onClick={() => toggleCollapse(UNCATEGORIZED_ID)}
              >
                {expandedCollections.has(UNCATEGORIZED_ID) ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
                <Inbox size={16} className={styles.collectionIcon} />
                <Text size='2' weight='medium' color='light'>
                  Uncategorized
                  <span style={{ marginLeft: '8px', opacity: 0.7 }}>
                    ({uncategorizedBookmarks.length})
                  </span>
                </Text>
              </button>
              {expandedCollections.has(UNCATEGORIZED_ID) &&
                uncategorizedBookmarks.map((bookmark: Bookmark) => (
                  <BookmarkCard
                    key={bookmark.id}
                    bookmark={bookmark}
                    tags={tags}
                    onDelete={onDelete}
                    isSelected={selectedBookmarkIds.has(bookmark.id)}
                    onToggleSelect={() => handleBookmarkToggle(bookmark.id)}
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
