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
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<Set<string>>(
    new Set()
  )

  return (
    <div className={styles.component}>
      <Header
        canSwitchToBookmark={true}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <div className={styles.content}>
        <BookmarkHeader
          searchQuery={searchQuery}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          selectedTags={selectedTags}
          onSelectedTagsChange={setSelectedTags}
          selectedBookmarkIds={selectedBookmarkIds}
          onDeleteSelected={() => {
            setSelectedBookmarkIds(new Set())
          }}
        />

        <BookmarkList
          searchQuery={searchQuery}
          currentTagId={null}
          sortMode={sortMode}
          selectedTags={selectedTags}
          selectedBookmarkIds={selectedBookmarkIds}
          onSelectedBookmarkIdsChange={setSelectedBookmarkIds}
        />
      </div>
    </div>
  )
}
