import { useCallback, useState } from 'react'

import type { Bookmark } from '@/lib/types'

/**
 * Hook for managing the tag management modal state
 */
export function useTagManageModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [bookmarkForTags, setBookmarkForTags] = useState<Bookmark | null>(null)

  const openForManagement = useCallback(() => {
    setBookmarkForTags(null)
    setIsOpen(true)
  }, [])

  const openForBookmark = useCallback((bookmark: Bookmark) => {
    setBookmarkForTags(bookmark)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setBookmarkForTags(null)
  }, [])

  return {
    isOpen,
    bookmarkForTags,
    openForManagement,
    openForBookmark,
    close
  }
}
