import { Inbox } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useCollections } from '@/components/hooks/useCollections'
import { useTags } from '@/components/hooks/useTags'
import { filterBookmarks } from '@/lib/bookmarkUtils'
import {
  filterEmptyCollections,
  flattenCollectionsWithBookmarks
} from '@/lib/collectionUtils'
import type { Bookmark } from '@/lib/types'

import BookmarkRow from '@/components/parts/BookmarkRow'
import Collapsible from '@/components/ui/Collapsible'
import CollectionItem from './CollectionItem'

import styles from './styles.module.css'

interface CollectionsListProps {
  searchQuery: string
  selectedTags: string[]
  onEdit?: (bookmark: Bookmark) => void
}

export default function CollectionsList({
  searchQuery,
  selectedTags,
  onEdit
}: CollectionsListProps) {
  const { bookmarks, updateBookmark, deleteBookmark } = useBookmarks()
  const { collections, updateCollection } = useCollections()
  const { tags } = useTags()
  const { setFlash } = useNavigation()

  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(
    null
  )
  const [editingName, setEditingName] = useState('')
  const containerRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const editingNameRef = useRef(editingName)

  useEffect(() => {
    editingNameRef.current = editingName
  }, [editingName])

  // Get non-pinned bookmarks with search and tag filtering
  const nonPinnedBookmarks = useMemo(() => {
    // Get non-pinned bookmarks
    const nonPinned = bookmarks.filter((b: Bookmark) => !b.pinned)

    // Apply search filter
    let filtered = filterBookmarks(nonPinned, tags, searchQuery)

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
  }, [bookmarks, tags, searchQuery, selectedTags])

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

  const cancelEditing = () => {
    setEditingCollectionId(null)
    setEditingName('')
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
            containerRef={(el) => {
              containerRefs.current[collection.id] = el
            }}
            inputRef={(el) => {
              inputRefs.current[collection.id] = el
            }}
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
              />
            ))}
          </div>
        </Collapsible>
      )}
    </div>
  )
}
