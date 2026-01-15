import { Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useManifest } from '@/components/hooks/providers/useManifestProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import usePopupSize from '@/components/hooks/usePopupSize'
import { captureCurrentPage, refreshBookmarkMetadata } from '@/lib/pageCapture'

import BookmarkForm, {
  type BookmarkFormData
} from '@/components/parts/Bookmarks/BookmarkForm'
import Header from '@/components/parts/Header'
import Button from '@/components/ui/Button'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

const emptyBookmark = {
  id: '',
  created_at: 0,
  updated_at: 0,
  url: '',
  title: '',
  note: '',
  picture: '',
  tags: [] as string[],
  collectionId: undefined as string | undefined
}

export default function Bookmark() {
  usePopupSize('compact')
  const { selectedBookmark, setFlash } = useNavigation()
  const { isSaving } = useManifest()
  const { addBookmark, updateBookmark, bookmarks } = useBookmarks()

  const [initialFormData, setInitialFormData] = useState<
    Partial<BookmarkFormData>
  >({})
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [existingBookmarkId, setExistingBookmarkId] = useState<string | null>(
    null
  )
  const hasLoadedRef = useRef(false)

  // Find the bookmark being edited (by selectedBookmark ID or by URL match)
  let bookmark =
    bookmarks.find(
      (item) => item.id === selectedBookmark || item.id === existingBookmarkId
    ) || null
  if (selectedBookmark === 'blank') {
    bookmark = emptyBookmark
  }
  // Initialize form data when editing an existing bookmark (via selectedBookmark)
  useEffect(() => {
    if (selectedBookmark && selectedBookmark !== 'blank' && bookmark?.id) {
      setInitialFormData({
        url: bookmark.url,
        title: bookmark.title,
        note: bookmark.note,
        picture: bookmark.picture,
        tags: bookmark.tags,
        collectionId: bookmark.collectionId,
        hidden: bookmark.hidden ?? false
      })
      hasLoadedRef.current = true
    }
  }, [selectedBookmark, bookmark])

  // Capture current page when creating a new bookmark
  useEffect(() => {
    if (hasLoadedRef.current || selectedBookmark) {
      return
    }

    const loadCurrentPage = async () => {
      setIsLoading(true)
      setFlash(null)

      const result = await captureCurrentPage()
      if (result.ok) {
        // Check if this URL already exists in bookmarks
        const trimmedUrl = result.bookmark.url.trim().toLowerCase()
        const existing = bookmarks.find(
          (b) => b.url.trim().toLowerCase() === trimmedUrl
        )

        if (existing) {
          // Switch to edit mode with existing bookmark data
          setExistingBookmarkId(existing.id)
          setInitialFormData({
            url: existing.url,
            title: existing.title,
            note: existing.note,
            picture: existing.picture,
            tags: existing.tags,
            collectionId: existing.collectionId,
            hidden: existing.hidden ?? false
          })
        } else {
          // New bookmark - use captured page data
          setInitialFormData({
            url: result.bookmark.url,
            title: result.bookmark.title,
            note: result.bookmark.note,
            picture: result.bookmark.picture,
            tags: result.bookmark.tags,
            collectionId: result.bookmark.collectionId,
            hidden: false
          })
        }
      } else {
        setFlash(result.error)
      }

      hasLoadedRef.current = true
      setIsLoading(false)
    }

    loadCurrentPage()
  }, [selectedBookmark, setFlash, bookmarks])

  const handleRefreshMetadata = async () => {
    if (!initialFormData.url?.trim()) {
      return
    }

    setIsRefreshing(true)
    setFlash(null)

    try {
      const result = await refreshBookmarkMetadata(initialFormData.url.trim())
      if (result.ok) {
        setInitialFormData((prev) => ({
          ...prev,
          title: result.title,
          picture: result.favicon
        }))
      } else {
        setFlash(result.error)
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to refresh metadata'
      setFlash(errorMessage)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSubmit = async (data: BookmarkFormData) => {
    setIsLoading(true)

    try {
      if (bookmark?.id) {
        await updateBookmark(bookmark.id, {
          url: data.url,
          title: data.title,
          note: data.note,
          picture: data.picture,
          tags: data.tags,
          collectionId: data.collectionId,
          hidden: data.hidden
        })
      } else {
        await addBookmark({
          url: data.url,
          title: data.title,
          note: data.note,
          picture: data.picture,
          tags: data.tags,
          collectionId: data.collectionId,
          hidden: data.hidden,
          pinned: false
        })
      }
      setIsSuccess(true)
    } catch (error) {
      setFlash(
        'Failed to save bookmark: ' +
          ((error as Error).message ?? 'Unknown error')
      )
    } finally {
      setIsLoading(false)
    }
  }

  const submitLabel = bookmark?.id ? 'Save' : 'Create'

  return (
    <div className={styles.component}>
      <Header
        rightContent={
          bookmark && bookmark.id ? (
            <Button
              onClick={handleRefreshMetadata}
              disabled={
                !initialFormData.url?.trim() || isRefreshing || isLoading
              }
              asIcon
              variant='ghost'
              className={styles.refreshButton}
              title='Refresh title and favicon from URL'
            >
              {isRefreshing ? (
                <Loader2
                  className={styles.refreshIcon}
                  size={18}
                  color='white'
                />
              ) : (
                <RefreshCw
                  className={styles.refreshIcon}
                  size={18}
                  color='white'
                />
              )}
            </Button>
          ) : null
        }
      />

      <div className={styles.page}>
        {bookmark?.id && (
          <div className={styles.pageTitle}>
            <Text as='h1' size='2' weight='medium'>
              {existingBookmarkId ? 'Already Bookmarked' : 'Edit Bookmark'}
            </Text>
          </div>
        )}

        <BookmarkForm
          initialData={initialFormData}
          onSubmit={handleSubmit}
          isSubmitting={isSaving}
          submitLabel={submitLabel}
          isSuccess={isSuccess}
          successMessage={
            bookmark?.id ? 'Bookmark updated!' : 'Bookmark saved!'
          }
        />
      </div>
    </div>
  )
}
