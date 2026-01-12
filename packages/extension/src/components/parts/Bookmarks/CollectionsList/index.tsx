import { Inbox } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useCollections } from '@/components/hooks/useCollections'
import { useTags } from '@/components/hooks/useTags'
import { filterBookmarks } from '@/lib/bookmarkUtils'
import {
  filterEmptyCollections,
  flattenCollectionsWithBookmarks,
  handleCollectionDrop
} from '@/lib/collectionUtils'
import type { Bookmark } from '@/lib/types'

import BookmarkRow from '@/components/parts/Bookmarks/BookmarkRow'
import Collapsible from '@/components/ui/Collapsible'
import CollectionItem, { type DragType, type DropZone } from './CollectionItem'

import styles from './styles.module.css'

interface CollectionsListProps {
  searchQuery: string
  selectedTags: string[]
  onEdit?: (bookmark: Bookmark) => void
  onAddTags?: (bookmark: Bookmark) => void
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

export default function CollectionsList({
  searchQuery,
  selectedTags,
  onEdit,
  onAddTags,
  selectedIds = new Set(),
  onToggleSelect
}: CollectionsListProps) {
  const { bookmarks, updateBookmark, deleteBookmark } = useBookmarks()
  const { collections, updateCollection, reorderCollections } = useCollections()
  const { tags, showHiddenTags } = useTags()
  const { setFlash } = useNavigation()

  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(
    null
  )
  const [editingName, setEditingName] = useState('')
  const containerRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const editingNameRef = useRef(editingName)

  // Drag and drop state for collections
  const [draggedCollectionId, setDraggedCollectionId] = useState<string | null>(
    null
  )
  const [dragOver, setDragOver] = useState<{
    id: string
    zone: DropZone
    type: DragType
  } | null>(null)

  // Drag state for bookmarks
  const [draggedBookmarkId, setDraggedBookmarkId] = useState<string | null>(
    null
  )

  useEffect(() => {
    editingNameRef.current = editingName
  }, [editingName])

  // Get non-pinned bookmarks with search and tag filtering
  const nonPinnedBookmarks = useMemo(() => {
    // Get non-pinned bookmarks
    const nonPinned = bookmarks.filter((b: Bookmark) => !b.pinned)

    // Apply search filter
    let filtered = filterBookmarks(nonPinned, tags, searchQuery)

    // Filter out bookmarks with hidden tags when showHiddenTags is false
    if (!showHiddenTags) {
      const hiddenTagIds = new Set(
        tags.filter((t) => t.hidden).map((t) => t.id)
      )
      filtered = filtered.filter(
        (bookmark) => !bookmark.tags.some((tagId) => hiddenTagIds.has(tagId))
      )
    }

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

    return filtered
  }, [bookmarks, tags, searchQuery, selectedTags, showHiddenTags])

  // Check if filtering is active
  const isFiltering = searchQuery.length > 0 || selectedTags.length > 0

  // Get collections with their bookmarks
  const collectionsWithBookmarks = useMemo(() => {
    const flattened = flattenCollectionsWithBookmarks(
      collections,
      nonPinnedBookmarks,
      'updated_at'
    )
    // Filter out empty collections when searching/filtering
    return isFiltering ? filterEmptyCollections(flattened) : flattened
  }, [collections, nonPinnedBookmarks, isFiltering])

  // Get uncategorized bookmarks (not pinned, not in any collection)
  const uncategorizedBookmarks = useMemo(
    () => nonPinnedBookmarks.filter((b: Bookmark) => !b.collectionId),
    [nonPinnedBookmarks]
  )

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

  const startEditing = (collectionId: string, currentName: string) => {
    setEditingCollectionId(collectionId)
    setEditingName(currentName)
  }

  const saveCollection = async (collectionId: string) => {
    const trimmedName = editingNameRef.current.trim()
    if (!trimmedName) {
      cancelEditing()
      return
    }

    try {
      await updateCollection(collectionId, { name: trimmedName })
      cancelEditing()
    } catch (error) {
      setFlash(`Failed to update collection: ${(error as Error).message}`)
      setTimeout(() => setFlash(null), 5000)
      cancelEditing()
    }
  }

  const handleIconChange = async (
    collectionId: string,
    icon: string | undefined
  ) => {
    try {
      await updateCollection(collectionId, { icon })
    } catch (error) {
      setFlash(`Failed to update icon: ${(error as Error).message}`)
      setTimeout(() => setFlash(null), 5000)
    }
  }

  const cancelEditing = () => {
    setEditingCollectionId(null)
    setEditingName('')
  }

  // Drag and drop handlers
  const handleDrop = async (
    targetId: string,
    zone: DropZone,
    type: DragType,
    bookmarkId?: string
  ) => {
    if (type === 'bookmark' && bookmarkId) {
      // Handle bookmark drop - move bookmark to collection
      await handleBookmarkDrop(bookmarkId, targetId)
      return
    }

    // Handle collection drop
    if (!draggedCollectionId || draggedCollectionId === targetId) {
      clearDragState()
      return
    }

    const result = handleCollectionDrop(
      collections,
      draggedCollectionId,
      targetId,
      zone
    )

    if ('error' in result) {
      setFlash(result.error)
      setTimeout(() => setFlash(null), 3000)
      clearDragState()
      return
    }

    try {
      await reorderCollections(result)
      clearDragState()
    } catch (error) {
      setFlash(`Failed to move: ${(error as Error).message}`)
      setTimeout(() => setFlash(null), 5000)
      clearDragState()
    }
  }

  const handleBookmarkDrop = async (
    bookmarkId: string,
    collectionId: string
  ) => {
    try {
      await updateBookmark(bookmarkId, { collectionId })
      clearDragState()
    } catch (error) {
      setFlash(`Failed to move bookmark: ${(error as Error).message}`)
      setTimeout(() => setFlash(null), 5000)
      clearDragState()
    }
  }

  const clearDragState = () => {
    setDraggedCollectionId(null)
    setDraggedBookmarkId(null)
    setDragOver(null)
  }

  useEffect(() => {
    if (!editingCollectionId) return

    const input = inputRefs.current[editingCollectionId]
    if (input) {
      input.focus()
      input.select()
    }

    const handleClickOutside = async (event: MouseEvent) => {
      const container = containerRefs.current[editingCollectionId]
      if (container && !container.contains(event.target as Node)) {
        const trimmedName = editingNameRef.current.trim()
        if (trimmedName) {
          try {
            await updateCollection(editingCollectionId, { name: trimmedName })
          } catch (error) {
            setFlash(`Failed to update collection: ${(error as Error).message}`)
            setTimeout(() => setFlash(null), 5000)
          }
        }
        setEditingCollectionId(null)
        setEditingName('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editingCollectionId, updateCollection, setFlash])

  if (
    collectionsWithBookmarks.length === 0 &&
    uncategorizedBookmarks.length === 0
  ) {
    return null
  }

  return (
    <div className={styles.component}>
      {collectionsWithBookmarks.map(
        ({ collection, bookmarks: collectionBookmarks, depth }) => (
          <CollectionItem
            key={collection.id}
            collection={collection}
            bookmarks={collectionBookmarks}
            depth={depth}
            tags={tags}
            isEditing={editingCollectionId === collection.id}
            editingName={editingName}
            onStartEdit={startEditing}
            onSave={saveCollection}
            onCancel={cancelEditing}
            onNameChange={setEditingName}
            onTogglePin={handleTogglePin}
            onDelete={handleDelete}
            onEdit={onEdit}
            onAddTags={onAddTags}
            onIconChange={handleIconChange}
            containerRef={(el) => {
              containerRefs.current[collection.id] = el
            }}
            inputRef={(el) => {
              inputRefs.current[collection.id] = el
            }}
            // Drag and drop props for collections
            draggable
            isDragging={draggedCollectionId === collection.id}
            dropZone={dragOver?.id === collection.id ? dragOver.zone : null}
            dropType={dragOver?.id === collection.id ? dragOver.type : null}
            onDragStart={() => setDraggedCollectionId(collection.id)}
            onDragOver={(_, zone, type) => {
              const canDrop =
                type === 'bookmark' ||
                (draggedCollectionId && draggedCollectionId !== collection.id)
              if (canDrop) {
                setDragOver({ id: collection.id, zone, type })
              }
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(zone, type, bookmarkId) =>
              handleDrop(collection.id, zone, type, bookmarkId)
            }
            onDragEnd={clearDragState}
            draggedBookmarkId={draggedBookmarkId}
            onBookmarkDragStart={(id) => setDraggedBookmarkId(id)}
            onBookmarkDragEnd={clearDragState}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
          />
        )
      )}

      {uncategorizedBookmarks.length > 0 && (
        <Collapsible
          icon={Inbox}
          label='Uncategorized'
          count={uncategorizedBookmarks.length}
          defaultOpen={false}
        >
          <div className={styles.bookmarksList}>
            {uncategorizedBookmarks.map((bookmark: Bookmark) => (
              <BookmarkRow
                key={bookmark.id}
                bookmark={bookmark}
                tags={tags}
                onTogglePin={() => handleTogglePin(bookmark)}
                onEdit={onEdit ? () => onEdit(bookmark) : undefined}
                onDelete={() => handleDelete(bookmark.id)}
                onAddTags={onAddTags ? () => onAddTags(bookmark) : undefined}
                draggable
                isDragging={draggedBookmarkId === bookmark.id}
                onDragStart={() => setDraggedBookmarkId(bookmark.id)}
                onDragEnd={clearDragState}
                selected={selectedIds.has(bookmark.id)}
                onToggleSelect={
                  onToggleSelect ? () => onToggleSelect(bookmark.id) : undefined
                }
              />
            ))}
          </div>
        </Collapsible>
      )}
    </div>
  )
}
