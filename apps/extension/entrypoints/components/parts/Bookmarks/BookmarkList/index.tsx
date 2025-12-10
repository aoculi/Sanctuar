import { useMemo } from 'react'

import { useTagVisibilityPreference } from '@/entrypoints/components/hooks/useTagVisibilityPreference'
import { BookmarkCard } from '@/entrypoints/components/parts/Bookmarks/BookmarkCard'
import Text from '@/entrypoints/components/ui/Text'
import { filterBookmarks } from '@/entrypoints/lib/bookmarkUtils'
import type { Bookmark, Tag } from '@/entrypoints/lib/types'

import styles from './styles.module.css'

type Props = {
  bookmarks: Bookmark[]
  tags: Tag[]
  searchQuery: string
  currentTagId: string | null
  onEdit: (bookmark: Bookmark) => void
  onDelete: (id: string) => void
}

export function BookmarkList({
  bookmarks,
  tags,
  searchQuery,
  currentTagId,
  onEdit,
  onDelete
}: Props) {
  const { showHiddenTags } = useTagVisibilityPreference()

  // Create a set of hidden tag IDs for efficient lookup
  const hiddenTagIds = useMemo(() => {
    return new Set(tags.filter((tag) => tag.hidden).map((tag) => tag.id))
  }, [tags])

  // Bookmarks that should be visible given the hidden tag setting
  const visibleBookmarks = useMemo(() => {
    if (showHiddenTags) {
      return bookmarks
    }

    return bookmarks.filter(
      (bookmark) => !bookmark.tags.some((tagId) => hiddenTagIds.has(tagId))
    )
  }, [bookmarks, showHiddenTags, hiddenTagIds])

  // Filter bookmarks based on search and selected tag
  const filteredBookmarks = useMemo(() => {
    let filtered = filterBookmarks(visibleBookmarks, tags, searchQuery)

    // Filter by selected tag (if not "all" or null)
    if (currentTagId && currentTagId !== 'all') {
      filtered = filtered.filter((bookmark) =>
        bookmark.tags.includes(currentTagId)
      )
    }

    return filtered
  }, [visibleBookmarks, tags, searchQuery, currentTagId])

  return (
    <div className={styles.container}>
      <Text size='2' color='light' style={{ padding: '20px 20px 0' }}>
        Bookmarks ({filteredBookmarks.length}
        {filteredBookmarks.length !== visibleBookmarks.length
          ? ` of ${visibleBookmarks.length}`
          : ''}
        )
      </Text>

      {visibleBookmarks.length === 0 ? (
        <Text size='2' color='light' style={{ padding: '20px 20px 0' }}>
          {bookmarks.length === 0
            ? 'No bookmarks yet. Click "Add Bookmark" to get started.'
            : 'No visible bookmarks. Enable hidden tags in settings or add new bookmarks.'}
        </Text>
      ) : filteredBookmarks.length === 0 ? (
        <Text size='2' color='light' style={{ padding: '20px 20px 0' }}>
          No bookmarks match your search.
        </Text>
      ) : (
        <div className={styles.list}>
          {filteredBookmarks.map((bookmark: Bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              tags={tags}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
