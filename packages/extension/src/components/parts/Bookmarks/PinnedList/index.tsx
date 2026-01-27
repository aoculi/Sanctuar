import { Pin } from 'lucide-react'
import { useMemo } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useSettings } from '@/components/hooks/providers/useSettingsProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useTags } from '@/components/hooks/useTags'
import { filterBookmarks } from '@/lib/bookmarkUtils'
import type { Bookmark } from '@/lib/types'

import BookmarkRow from '@/components/parts/Bookmarks/BookmarkRow'
import Collapsible from '@/components/ui/Collapsible'

import styles from './styles.module.css'

interface PinnedListProps {
  searchQuery: string
  selectedTags: string[]
  selectedCollectionId?: string | null
  onEdit?: (bookmark: Bookmark) => void
  onAddTags?: (bookmark: Bookmark) => void
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

export default function PinnedList({
  searchQuery,
  selectedTags,
  selectedCollectionId,
  onEdit,
  onAddTags,
  selectedIds = new Set(),
  onToggleSelect
}: PinnedListProps) {
  const { bookmarks, updateBookmark, deleteBookmark } = useBookmarks()
  const { tags } = useTags()
  const { settings } = useSettings()
  const { setFlash } = useNavigation()

  const pinnedBookmarks = useMemo(() => {
    // Get pinned bookmarks
    let filtered = bookmarks.filter((bookmark: Bookmark) => bookmark.pinned)

    // Filter out hidden bookmarks when showHiddenBookmarks is false
    if (!settings.showHiddenBookmarks) {
      filtered = filtered.filter((bookmark) => !bookmark.hidden)
    }

    // Apply search filter
    filtered = filterBookmarks(filtered, tags, searchQuery)

    // Apply tag filter
    if (selectedTags.length > 0) {
      if (selectedTags.includes('unsorted')) {
        filtered = filtered.filter((bookmark) => bookmark.tags.length === 0)
      } else {
        filtered = filtered.filter((bookmark) =>
          selectedTags.some((tagId) => bookmark.tags.includes(tagId))
        )
      }
    }

    // Apply collection filter
    if (selectedCollectionId) {
      if (selectedCollectionId === 'uncategorized') {
        filtered = filtered.filter((bookmark) => !bookmark.collectionId)
      } else {
        filtered = filtered.filter(
          (bookmark) => bookmark.collectionId === selectedCollectionId
        )
      }
    }

    return filtered.sort(
      (a: Bookmark, b: Bookmark) => b.updated_at - a.updated_at
    )
  }, [
    bookmarks,
    tags,
    searchQuery,
    selectedTags,
    selectedCollectionId,
    settings.showHiddenBookmarks
  ])

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

  if (pinnedBookmarks.length === 0) {
    return null
  }

  return (
    <div className={styles.component}>
      <Collapsible
        icon={Pin}
        label='Pinned'
        count={pinnedBookmarks.length}
        defaultOpen={true}
      >
        <div className={styles.list}>
          {pinnedBookmarks.map((bookmark: Bookmark) => (
            <BookmarkRow
              key={bookmark.id}
              bookmark={bookmark}
              tags={tags}
              onTogglePin={() => handleTogglePin(bookmark)}
              onEdit={onEdit ? () => onEdit(bookmark) : undefined}
              onDelete={() => handleDelete(bookmark.id)}
              onAddTags={onAddTags ? () => onAddTags(bookmark) : undefined}
              selected={selectedIds.has(bookmark.id)}
              onToggleSelect={
                onToggleSelect ? () => onToggleSelect(bookmark.id) : undefined
              }
            />
          ))}
        </div>
      </Collapsible>
    </div>
  )
}
