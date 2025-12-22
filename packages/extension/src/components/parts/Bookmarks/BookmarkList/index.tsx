import { useMemo } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useTags } from '@/components/hooks/useTags'
import { filterBookmarks } from '@/lib/bookmarkUtils'
import type { Bookmark } from '@/lib/types'

import { BookmarkCard } from '@/components/parts/Bookmarks/BookmarkCard'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

type Props = {
  searchQuery: string
  currentTagId: string | null
}

export default function BookmarkList({ searchQuery, currentTagId }: Props) {
  const { bookmarks, deleteBookmark } = useBookmarks()
  const { tags, showHiddenTags } = useTags()
  const { setFlash } = useNavigation()

  const onDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this bookmark?')) {
      try {
        await deleteBookmark(id)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to delete bookmark'
        setFlash(errorMessage)
        setTimeout(() => setFlash(null), 5000)
      }
    }
  }

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
      if (currentTagId === 'unsorted') {
        filtered = filtered.filter((bookmark) => bookmark.tags.length === 0)
      } else {
        filtered = filtered.filter((bookmark) =>
          bookmark.tags.includes(currentTagId)
        )
      }
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
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
