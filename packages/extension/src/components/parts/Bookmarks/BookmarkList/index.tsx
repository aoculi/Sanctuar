import { useEffect, useMemo, useState } from 'react'

import { loadManifestData } from '@/components/hooks/useManifest'
import { filterBookmarks } from '@/lib/bookmarkUtils'
import { STORAGE_KEYS } from '@/lib/constants'
import { getDefaultSettings, getStorageItem, Settings } from '@/lib/storage'
import type { Bookmark, ManifestV1, Tag } from '@/lib/types'

import { BookmarkCard } from '@/components/parts/Bookmarks/BookmarkCard'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

type Props = {
  searchQuery: string
  currentTagId: string | null
  setSelectedBookmark: (id: string) => void
}

export default function BookmarkList({
  searchQuery,
  currentTagId,
  setSelectedBookmark
}: Props) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [settings, setSettings] = useState<Settings>(getDefaultSettings())
  const [manifest, setManifest] = useState<ManifestV1 | null>(null)
  const [tags, setTags] = useState<Tag[]>([])

  useEffect(() => {
    const loadData = async () => {
      const [storedData, storedSettings] = await Promise.all([
        loadManifestData(),
        getStorageItem<Settings>(STORAGE_KEYS.SETTINGS)
      ])

      if (storedData) {
        setManifest(storedData.manifest)
        setBookmarks(storedData.manifest.items || [])
        if (storedData.manifest.tags) {
          setTags(storedData.manifest.tags)
        }
      }

      if (storedSettings) {
        setSettings(storedSettings)
      }
    }

    loadData()
  }, [])

  const onDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this bookmark?')) {
      try {
        // deleteBookmark(id)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to delete bookmark'
        // setMessage(errorMessage)
        // setTimeout(() => setMessage(null), 5000)
      }
    }
  }

  // Create a set of hidden tag IDs for efficient lookup
  const hiddenTagIds = useMemo(() => {
    return new Set(tags.filter((tag) => tag.hidden).map((tag) => tag.id))
  }, [tags])

  // Bookmarks that should be visible given the hidden tag setting
  const visibleBookmarks = useMemo(() => {
    if (settings.showHiddenTags) {
      return bookmarks
    }

    return bookmarks.filter(
      (bookmark) => !bookmark.tags.some((tagId) => hiddenTagIds.has(tagId))
    )
  }, [bookmarks, settings.showHiddenTags, hiddenTagIds])

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
              setSelectedBookmark={setSelectedBookmark}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
