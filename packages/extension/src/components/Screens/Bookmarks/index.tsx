import { useState } from 'react'

import usePopupSize from '@/components/hooks/usePopupSize'
import { Bookmark } from '@/lib/types'

import BookmarkHeader from '@/components/parts/Bookmarks/BookmarkHeader'
import BookmarkList from '@/components/parts/Bookmarks/BookmarkList'
import Header from '@/components/parts/Header'

import Tags from '@/components/parts/Tags'
import styles from './styles.module.css'

export default function Bookmarks() {
  usePopupSize('large')

  const [currentTagId, setCurrentTagId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(
    null
  )

  const handleShowBookmarkModal = (bookmark: Bookmark) => {
    setSelectedBookmark(bookmark)
  }

  const onSelectTag = (id: string) => {
    setCurrentTagId(id)
  }

  return (
    <div className={styles.component}>
      <Header canSwitchToBookmark={true} />
      <div className={styles.content}>
        <div className={styles.left}>
          <Tags currentTagId={currentTagId} onSelectTag={onSelectTag} />
        </div>
        <div className={styles.right}>
          <BookmarkHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          <BookmarkList
            searchQuery={searchQuery}
            currentTagId={currentTagId}
            onEdit={handleShowBookmarkModal}
          />
        </div>
      </div>
    </div>
  )
}
