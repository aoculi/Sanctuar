import { useCallback, useMemo, useState } from 'react'

import { useBookmarks } from '@/components/hooks/useBookmarks'
import type { Bookmark } from '@/lib/types'

/**
 * Hook for managing bookmark selection state
 */
export function useBookmarkSelection(selectedCollectionId: string | null) {
  const { bookmarks } = useBookmarks()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filteredBookmarks = useMemo(() => {
    if (!selectedCollectionId) {
      return bookmarks
    }
    if (selectedCollectionId === 'uncategorized') {
      return bookmarks.filter((b: Bookmark) => !b.collectionId)
    }
    return bookmarks.filter(
      (b: Bookmark) => b.collectionId === selectedCollectionId
    )
  }, [bookmarks, selectedCollectionId])

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSelected = new Set(prev)
      if (newSelected.has(id)) {
        newSelected.delete(id)
      } else {
        newSelected.add(id)
      }
      return newSelected
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filteredBookmarks.length) {
        return new Set()
      }
      return new Set(filteredBookmarks.map((b: Bookmark) => b.id))
    })
  }, [filteredBookmarks])

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  return {
    selectedIds,
    filteredBookmarks,
    handleToggleSelect,
    handleSelectAll,
    handleClearSelection
  }
}
