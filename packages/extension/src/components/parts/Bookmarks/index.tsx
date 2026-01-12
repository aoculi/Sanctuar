import { useState } from 'react'

import { useBookmarks } from '@/components/hooks/useBookmarks'
import type { Bookmark } from '@/lib/types'

import BookmarkEditModal from '@/components/parts/Bookmarks/BookmarkEditModal'
import BulkActionBar from '@/components/parts/Bookmarks/BulkActionBar'
import CollectionsList from '@/components/parts/Bookmarks/CollectionsList'
import CreateCollection from '@/components/parts/Bookmarks/CreateCollection'
import PinnedList from '@/components/parts/Bookmarks/PinnedList'
import SmartSearch from '@/components/parts/Bookmarks/SmartSearch'
import PinnedTags from '@/components/parts/Tags/PinnedTags'
import TagManageModal from '@/components/parts/Tags/TagManageModal'

interface BookmarksProps {
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { bookmarks } = useBookmarks()

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

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedIds.size === bookmarks.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(bookmarks.map((b: Bookmark) => b.id)))
    }
  }

  const handleClearSelection = () => {
    setSelectedIds(new Set())
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
      <BulkActionBar
        totalCount={bookmarks.length}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
      />
      <PinnedList
        searchQuery={searchQuery}
        selectedTags={selectedTags}
        onEdit={setEditingBookmark}
        onAddTags={handleAddTags}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
      />
      <CreateCollection />
      <CollectionsList
        searchQuery={searchQuery}
        selectedTags={selectedTags}
        onEdit={setEditingBookmark}
        onAddTags={handleAddTags}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
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
