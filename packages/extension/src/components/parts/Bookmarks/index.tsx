import { useState } from 'react'

import type { Bookmark } from '@/lib/types'

import BookmarkHeader from '@/components/parts/Bookmarks/BookmarkHeader'
import BookmarkList from '@/components/parts/Bookmarks/BookmarkList'

import styles from './styles.module.css'

export default function Bookmarks({
  currentTagId
}: {
  currentTagId: string | null
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(
    null
  )

  const handleShowBookmarkModal = (bookmark: Bookmark) => {
    setSelectedBookmark(bookmark)
  }

  return (
    <div className={styles.container}>
      <BookmarkHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <BookmarkList searchQuery={searchQuery} currentTagId={currentTagId} />
    </div>
  )
}
