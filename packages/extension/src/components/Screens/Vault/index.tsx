import { useState } from 'react'

import usePopupSize from '@/components/hooks/usePopupSize'

import BookmarkHeader from '@/components/parts/Bookmarks/BookmarkHeader'
import BookmarkList from '@/components/parts/Bookmarks/BookmarkList'
import Header from '@/components/parts/Header'

import styles from './styles.module.css'

export default function Vault() {
  usePopupSize('large')

  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<'updated_at' | 'title'>('updated_at')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  return (
    <div className={styles.component}>
      <Header canSwitchToBookmark={true} />
      <div className={styles.content}>
        <BookmarkHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          selectedTags={selectedTags}
          onSelectedTagsChange={setSelectedTags}
        />

        <BookmarkList
          searchQuery={searchQuery}
          currentTagId={null}
          sortMode={sortMode}
          selectedTags={selectedTags}
        />
      </div>
    </div>
  )
}
