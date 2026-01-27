import { useState } from 'react'

import { useBookmarkSelection } from '@/components/hooks/useBookmarkSelection'
import { useTagManageModal } from '@/components/hooks/useTagManageModal'
import type { Bookmark } from '@/lib/types'

import BookmarkEditModal from '@/components/parts/Bookmarks/BookmarkEditModal'
import BulkActionBar from '@/components/parts/Bookmarks/BulkActionBar'
import CreateCollection from '@/components/parts/Bookmarks/CreateCollection'
import PinnedList from '@/components/parts/Bookmarks/PinnedList'
import SmartSearch from '@/components/parts/Bookmarks/SmartSearch'
import BookmarkList from '@/components/parts/BookmarkList'
import CollectionHeader from '@/components/parts/CollectionHeader'
import CollectionTree from '@/components/parts/CollectionTree'
import PinnedTags from '@/components/parts/Tags/PinnedTags'
import TagManageModal from '@/components/parts/Tags/TagManageModal'

import styles from './styles.module.css'

interface BookmarksViewProps {
  searchQuery: string
  selectedTags: string[]
  onSearchChange: (query: string) => void
  onSelectedTagsChange: (tags: string[]) => void
}

export default function BookmarksView({
  searchQuery,
  selectedTags,
  onSearchChange,
  onSelectedTagsChange
}: BookmarksViewProps) {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null)

  const {
    selectedIds,
    filteredBookmarks,
    handleToggleSelect,
    handleSelectAll,
    handleClearSelection
  } = useBookmarkSelection(selectedCollectionId)

  const tagModal = useTagManageModal()

  const handleTagClick = (tagId: string) => {
    onSelectedTagsChange(
      selectedTags.includes(tagId)
        ? selectedTags.filter((id) => id !== tagId)
        : [...selectedTags, tagId]
    )
  }

  return (
    <>
      {/* Top section - full width */}
      <div className={styles.topSection}>
        <SmartSearch
          searchQuery={searchQuery}
          selectedTags={selectedTags}
          onSearchChange={onSearchChange}
          onSelectedTagsChange={onSelectedTagsChange}
        />
        <PinnedTags
          selectedTags={selectedTags}
          onTagClick={handleTagClick}
          onManageTags={tagModal.openForManagement}
        />
      </div>

      {/* Two column section */}
      <div className={styles.twoColumns}>
        <div className={styles.sidebar}>
          <CreateCollection />
          <CollectionTree
            selectedCollectionId={selectedCollectionId}
            onSelectCollection={setSelectedCollectionId}
          />
        </div>
        <div className={styles.main}>
          <CollectionHeader
            collectionId={selectedCollectionId}
            onCollectionDeleted={() => setSelectedCollectionId(null)}
          />
          <BulkActionBar
            totalCount={filteredBookmarks.length}
            selectedIds={selectedIds}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
          />
          <PinnedList
            searchQuery={searchQuery}
            selectedTags={selectedTags}
            selectedCollectionId={selectedCollectionId}
            onEdit={setEditingBookmark}
            onAddTags={tagModal.openForBookmark}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
          />
          <BookmarkList
            searchQuery={searchQuery}
            selectedTags={selectedTags}
            selectedCollectionId={selectedCollectionId}
            onEdit={setEditingBookmark}
            onAddTags={tagModal.openForBookmark}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
          />
        </div>
      </div>

      <BookmarkEditModal
        bookmark={editingBookmark}
        onClose={() => setEditingBookmark(null)}
      />
      <TagManageModal
        open={tagModal.isOpen}
        onClose={tagModal.close}
        bookmark={tagModal.bookmarkForTags}
      />
    </>
  )
}
