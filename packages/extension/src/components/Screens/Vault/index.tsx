import { useState } from 'react'

import usePopupSize from '@/components/hooks/usePopupSize'

import BookmarkHeader from '@/components/parts/Bookmarks/BookmarkHeader'
import BookmarkList from '@/components/parts/Bookmarks/BookmarkList'
import Header from '@/components/parts/Header'
import Tags from '@/components/parts/Tags'

import styles from './styles.module.css'

export default function Vault() {
  usePopupSize('large')

  const [currentTagId, setCurrentTagId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const onSelectFilterTag = (id: string) => {
    setCurrentTagId(id)
  }

  return (
    <div className={styles.component}>
      <Header canSwitchToBookmark={true} />
      <div className={styles.content}>
        <Tags
          currentTagId={currentTagId}
          onSelectFilterTag={onSelectFilterTag}
        />
        <div className={styles.right}>
          <BookmarkHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          <BookmarkList searchQuery={searchQuery} currentTagId={currentTagId} />
        </div>
      </div>
    </div>
  )
}
