import { useMemo } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useSettings } from '@/components/hooks/providers/useSettingsProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useDragReorder, type SimpleDropZone } from '@/components/hooks/useDragReorder'
import { useTags } from '@/components/hooks/useTags'
import { filterBookmarks } from '@/lib/bookmarkUtils'
import type { Bookmark } from '@/lib/types'

import BookmarkRow from '@/components/parts/Bookmarks/BookmarkRow'

import styles from './styles.module.css'

interface BookmarkListProps {
  searchQuery: string
  selectedTags: string[]
  selectedCollectionId: string | null
  onEdit?: (bookmark: Bookmark) => void
  onAddTags?: (bookmark: Bookmark) => void
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

export default function BookmarkList({
  searchQuery,
  selectedTags,
  selectedCollectionId,
  onEdit,
  onAddTags,
  selectedIds = new Set(),
  onToggleSelect
}: BookmarkListProps) {
  const { bookmarks, updateBookmark, deleteBookmark, reorderBookmarks } =
    useBookmarks()
  const { tags } = useTags()
  const { settings } = useSettings()
  const { setFlash } = useNavigation()

  const {
    draggedId,
    getDropZone,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDragEnd,
    clearDragState,
    isDragging,
    getDropZoneForTarget
  } = useDragReorder<SimpleDropZone>()

  const filteredBookmarks = useMemo(() => {
    let filtered = bookmarks.filter((b: Bookmark) => !b.pinned)

    if (!settings.showHiddenBookmarks) {
      filtered = filtered.filter((bookmark) => !bookmark.hidden)
    }

    filtered = filterBookmarks(filtered, tags, searchQuery)

    if (selectedTags.length > 0) {
      if (selectedTags.includes('unsorted')) {
        filtered = filtered.filter((bookmark) => bookmark.tags.length === 0)
      } else {
        filtered = filtered.filter((bookmark) =>
          selectedTags.some((tagId) => bookmark.tags.includes(tagId))
        )
      }
    }

    if (selectedCollectionId) {
      if (selectedCollectionId === 'uncategorized') {
        filtered = filtered.filter((bookmark) => !bookmark.collectionId)
      } else {
        filtered = filtered.filter(
          (bookmark) => bookmark.collectionId === selectedCollectionId
        )
      }
    }

    return filtered.sort((a: Bookmark, b: Bookmark) => {
      const orderA = a.order ?? Number.MAX_SAFE_INTEGER
      const orderB = b.order ?? Number.MAX_SAFE_INTEGER
      if (orderA !== orderB) return orderA - orderB
      return b.updated_at - a.updated_at
    })
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

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) {
      clearDragState()
      return
    }

    const zone = getDropZone(e)
    const currentIds = filteredBookmarks.map((b) => b.id)
    const draggedIndex = currentIds.indexOf(draggedId)
    const targetIndex = currentIds.indexOf(targetId)

    if (draggedIndex === -1 || targetIndex === -1) {
      clearDragState()
      return
    }

    const newIds = currentIds.filter((id) => id !== draggedId)
    const insertIndex = zone === 'above' ? targetIndex : targetIndex + 1
    const adjustedIndex = draggedIndex < targetIndex ? insertIndex - 1 : insertIndex
    newIds.splice(adjustedIndex, 0, draggedId)

    try {
      await reorderBookmarks(newIds)
    } catch (error) {
      setFlash(`Failed to reorder: ${(error as Error).message}`)
      setTimeout(() => setFlash(null), 5000)
    }
    clearDragState()
  }

  const getDropZoneClass = (bookmarkId: string) => {
    const zone = getDropZoneForTarget(bookmarkId)
    if (!zone) return ''
    return zone === 'above' ? styles.dropAbove : styles.dropBelow
  }

  if (filteredBookmarks.length === 0) {
    return null
  }

  return (
    <div className={styles.component}>
      {filteredBookmarks.map((bookmark: Bookmark) => (
        <div
          key={bookmark.id}
          className={`${styles.itemWrapper} ${isDragging(bookmark.id) ? styles.dragging : ''} ${getDropZoneClass(bookmark.id)}`}
          draggable
          onDragStart={() => handleDragStart(bookmark.id)}
          onDragOver={(e) => handleDragOver(e, bookmark.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, bookmark.id)}
          onDragEnd={handleDragEnd}
        >
          <BookmarkRow
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
        </div>
      ))}
    </div>
  )
}
