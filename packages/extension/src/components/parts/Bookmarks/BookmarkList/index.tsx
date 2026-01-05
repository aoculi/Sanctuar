import { Folder } from 'lucide-react'
import { useMemo } from 'react'

import { useManifest } from '@/components/hooks/providers/useManifestProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useTags } from '@/components/hooks/useTags'
import { getIconByName } from '@/components/ui/IconPicker'
import { processBookmarks } from '@/lib/bookmarkUtils'
import type { Bookmark, Collection } from '@/lib/types'

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

  // Get collections and group bookmarks by collection
  const collections = manifest?.collections || []

  // Filter bookmarks that match a collection's tag filter
  // Note: allBookmarks should already be filtered by search query and selected tags
  const getBookmarksForCollection = (
    collection: Collection,
    allBookmarks: Bookmark[]
  ): Bookmark[] => {
    if (collection.tagFilter.tagIds.length === 0) {
      return []
    }

    // Filter bookmarks based on collection's tag filter
    let matching = allBookmarks.filter((bookmark) => {
      if (collection.tagFilter.mode === 'any') {
        // Match if bookmark has ANY of the filter tags
        return collection.tagFilter.tagIds.some((tagId) =>
          bookmark.tags.includes(tagId)
        )
      } else {
        // Match if bookmark has ALL of the filter tags
        return collection.tagFilter.tagIds.every((tagId) =>
          bookmark.tags.includes(tagId)
        )
      }
    })

    // Sort using collection's sortMode or fallback to global sortMode
    const collectionSortMode = collection.sortMode || sortMode
    if (collectionSortMode === 'title') {
      matching.sort((a, b) => a.title.localeCompare(b.title))
    } else {
      matching.sort((a, b) => b.updated_at - a.updated_at)
    }

    return matching
  }

  // Group bookmarks by collection and build tree structure
  const collectionsWithBookmarks = useMemo(() => {
    type CollectionWithBookmarks = {
      collection: Collection
      bookmarks: Bookmark[]
      depth: number
    }

    // First, get bookmarks for all collections
    const bookmarksByCollectionId = new Map<string, Bookmark[]>()
    collections.forEach((collection) => {
      const collectionBookmarks = getBookmarksForCollection(
        collection,
        nonPinnedBookmarks
      )
      bookmarksByCollectionId.set(collection.id, collectionBookmarks)
    })

    // Build parent-child relationships
    const childrenMap = new Map<string, Collection[]>()
    const rootCollections: Collection[] = []

    collections.forEach((collection) => {
      if (!collection.parentId) {
        rootCollections.push(collection)
      } else {
        if (!childrenMap.has(collection.parentId)) {
          childrenMap.set(collection.parentId, [])
        }
        childrenMap.get(collection.parentId)!.push(collection)
      }
    })

    // Recursively build flattened list with depth
    const flattenWithDepth = (
      items: Collection[],
      depth: number
    ): CollectionWithBookmarks[] => {
      const result: CollectionWithBookmarks[] = []

      // Sort collections alphabetically
      const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name))

      sorted.forEach((collection) => {
        const bookmarks = bookmarksByCollectionId.get(collection.id) || []
        result.push({
          collection,
          bookmarks,
          depth
        })

        const children = childrenMap.get(collection.id) || []
        if (children.length > 0) {
          result.push(...flattenWithDepth(children, depth + 1))
        }
      })

      return result
    }

    return flattenWithDepth(rootCollections, 0)
  }, [
    collections,
    nonPinnedBookmarks,
    tags,
    searchQuery,
    selectedTags,
    currentTagId,
    sortMode
  ])

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
              const Icon = collection.icon
                ? getIconByName(collection.icon)
                : Folder
              return (
                <div key={collection.id} className={styles.collectionGroup}>
                  <div
                    className={styles.collectionHeader}
                    style={{ paddingLeft: `${depth * 20 + 12}px` }}
                  >
                    <Icon size={16} className={styles.collectionIcon} />
                    <Text size='2' weight='medium' color='light'>
                      {collection.name}
                      {collectionBookmarks.length > 0 && (
                        <span style={{ marginLeft: '8px', opacity: 0.7 }}>
                          ({collectionBookmarks.length})
                        </span>
                      )}
                    </Text>
                  </div>
                  {collectionBookmarks.length > 0 &&
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
          {/* Show remaining non-pinned bookmarks that don't belong to any collection */}
          {nonPinnedBookmarks
            .filter(
              (bookmark) =>
                !collectionsWithBookmarks.some(({ bookmarks }) =>
                  bookmarks.some((b) => b.id === bookmark.id)
                )
            )
            .map((bookmark: Bookmark) => (
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
  )
}
