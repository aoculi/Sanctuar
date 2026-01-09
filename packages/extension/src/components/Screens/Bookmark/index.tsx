import { Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

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
  const { navigate, selectedBookmark, setFlash } = useNavigation()
  const { isSaving } = useManifest()
  const { addBookmark, updateBookmark, bookmarks } = useBookmarks()

  let bookmark = bookmarks.find((item) => item.id === selectedBookmark) || null
  if (selectedBookmark === 'blank') {
    bookmark = emptyBookmark
  }

  const [initialFormData, setInitialFormData] = useState<
    Partial<BookmarkFormData>
  >({})
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Initialize form data when editing an existing bookmark
  useEffect(() => {
    if (bookmark) {
      setInitialFormData({
        url: bookmark.url,
        title: bookmark.title,
        note: bookmark.note,
        picture: bookmark.picture,
        tags: bookmark.tags,
        collectionId: bookmark.collectionId
      })
    }
  }, [bookmark])

  // Check for duplicate URL when creating a new bookmark
  useEffect(() => {
    if (!bookmark && initialFormData.url?.trim()) {
      const trimmedUrl = initialFormData.url.trim()
      const duplicate = bookmarks.find(
        (b) => b.url.trim().toLowerCase() === trimmedUrl.toLowerCase()
      )
      if (duplicate) {
        setFlash('This page is already bookmarked')
      }
    }
  }, [initialFormData.url, bookmarks, bookmark, setFlash])

  // Capture current page when creating a new bookmark
  useEffect(() => {
    if (bookmark || selectedBookmark) {
      return
    }

    const loadCurrentPage = async () => {
      setIsLoading(true)
      setFlash(null)

      const result = await captureCurrentPage()
      if (result.ok) {
        setInitialFormData({
          url: result.bookmark.url,
          title: result.bookmark.title,
          note: result.bookmark.note,
          picture: result.bookmark.picture,
          tags: result.bookmark.tags,
          collectionId: result.bookmark.collectionId
        })
      } else {
        setFlash(result.error)
      }

      setIsLoading(false)
    }

    loadCurrentPage()
  }, [bookmark, selectedBookmark, setFlash])

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
      if (bookmark) {
        await updateBookmark(bookmark.id, {
          url: data.url,
          title: data.title,
          note: data.note,
          picture: data.picture,
          tags: data.tags,
          collectionId: data.collectionId
        })
      } else {
        await addBookmark({
          url: data.url,
          title: data.title,
          note: data.note,
          picture: data.picture,
          tags: data.tags,
          collectionId: data.collectionId,
          pinned: false
        })
      }

      navigate('/vault')
    } catch (error) {
      setFlash(
        'Failed to save bookmark: ' +
          ((error as Error).message ?? 'Unknown error')
      )
    } finally {
      setIsLoading(false)
    }
  }

  const submitLabel = bookmark ? 'Save' : 'Create'

  return (
    <div className={styles.component}>
      <Header
        title={bookmark ? 'Edit' : 'New'}
        canSwitchToVault={true}
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
        <BookmarkForm
          initialData={initialFormData}
          onSubmit={handleSubmit}
          isSubmitting={isLoading || isSaving}
          submitLabel={submitLabel}
        />
      </div>
    </div>
  )
}
