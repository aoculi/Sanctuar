import { useState } from 'react'

import type { Bookmark } from '@/lib/types'

import BookmarkEditModal from '@/components/parts/Bookmarks/BookmarkEditModal'
import CollectionsList from '@/components/parts/Bookmarks/CollectionsList'
import CreateCollection from '@/components/parts/Bookmarks/CreateCollection'
import PinnedList from '@/components/parts/Bookmarks/PinnedList'
import SmartSearch from '@/components/parts/Bookmarks/SmartSearch'
import PinnedTags from '@/components/parts/Tags/PinnedTags'
import TagManageModal from '@/components/parts/Tags/TagManageModal'

export interface BookmarksProps {
  searchQuery: string
  selectedTags: string[]
  onSearchChange: (query: string) => void
  onSelectedTagsChange: (tags: string[]) => void
}

export default function Bookmarks({
  searchQuery,
  selectedTags,
  onSearchChange,
  onSelectedTagsChange
}: BookmarksProps) {
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null)
  const [showTagManageModal, setShowTagManageModal] = useState(false)
  const [bookmarkForTags, setBookmarkForTags] = useState<Bookmark | null>(null)

  const handleTagClick = (tagId: string) => {
    onSelectedTagsChange(
      selectedTags.includes(tagId)
        ? selectedTags.filter((id) => id !== tagId)
        : [...selectedTags, tagId]
    )
  }

  const handleManageTags = () => {
    setBookmarkForTags(null)
    setShowTagManageModal(true)
  }

  const handleAddTags = (bookmark: Bookmark) => {
    setBookmarkForTags(bookmark)
    setShowTagManageModal(true)
  }

  const handleTagManageClose = () => {
    setShowTagManageModal(false)
    setBookmarkForTags(null)
  }

  return (
    <>
      <SmartSearch
        searchQuery={searchQuery}
        selectedTags={selectedTags}
        onSearchChange={onSearchChange}
        onSelectedTagsChange={onSelectedTagsChange}
      />
      <PinnedTags
        selectedTags={selectedTags}
        onTagClick={handleTagClick}
        onManageTags={handleManageTags}
      />
      <PinnedList
        searchQuery={searchQuery}
        selectedTags={selectedTags}
        onEdit={setEditingBookmark}
        onAddTags={handleAddTags}
      />
      <CreateCollection />
      <CollectionsList
        searchQuery={searchQuery}
        selectedTags={selectedTags}
        onEdit={setEditingBookmark}
        onAddTags={handleAddTags}
      />
      <BookmarkEditModal
        bookmark={editingBookmark}
        onClose={() => setEditingBookmark(null)}
      />
      <TagManageModal
        open={showTagManageModal}
        onClose={handleTagManageClose}
        bookmark={bookmarkForTags}
      />
    </>
  )
}
