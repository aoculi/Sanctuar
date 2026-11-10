import { Check, ExternalLink, Loader2, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useManifest } from '@/components/hooks/providers/useManifestProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useCollections } from '@/components/hooks/useCollections'
import usePopupSize from '@/components/hooks/usePopupSize'
import { captureCurrentPage, refreshBookmarkMetadata } from '@/lib/pageCapture'
import { STORAGE_KEYS } from '@/lib/constants'
import { getStorageItem, setStorageItem } from '@/lib/storage'
import { openExtensionPage } from '@/lib/tabs'
import type { Bookmark as BookmarkItem } from '@/lib/types'
import { formatRelativeTime, normalizeUrl } from '@/lib/utils'

import BookmarkForm, {
  type BookmarkFormData
} from '@/components/parts/Bookmarks/BookmarkForm'
import Header from '@/components/parts/Header'
import Button from '@/components/ui/Button'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

/** What the last action did, so the result screen can offer Undo */
type Outcome =
  | { kind: 'created'; bookmark: BookmarkItem }
  | { kind: 'updated'; previous: BookmarkItem }
  | { kind: 'removed'; bookmark: BookmarkItem }

const toFormData = (b: BookmarkItem): Partial<BookmarkFormData> => ({
  url: b.url,
  title: b.title,
  note: b.note,
  picture: b.picture,
  tags: b.tags,
  collectionId: b.collectionId,
  hidden: b.hidden ?? false
})

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
  const {
    addBookmark,
    updateBookmark,
    deleteBookmark,
    restoreBookmark,
    bookmarks
  } = useBookmarks()
  const { collections } = useCollections()

  // The collection used for the last new bookmark, if it still exists
  const getLastCollectionId = async (): Promise<string | undefined> => {
    try {
      const id = await getStorageItem<string>(STORAGE_KEYS.LAST_COLLECTION)
      return id && collections.some((c) => c.id === id) ? id : undefined
    } catch {
      return undefined
    }
  }

  const [initialFormData, setInitialFormData] = useState<
    Partial<BookmarkFormData>
  >({})
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [isWorking, setIsWorking] = useState(false)
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
    if (selectedBookmark === 'blank') {
      if (hasLoadedRef.current) return
      hasLoadedRef.current = true
      getLastCollectionId().then((collectionId) =>
        setInitialFormData({ url: '', title: '', note: '', picture: '', tags: [], collectionId, hidden: false })
      )
      return
    }
    if (selectedBookmark && bookmark?.id) {
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
        // Check if this page is already saved (ignoring tracking params,
        // www., trailing slash, #fragment, http vs https)
        const normalized = normalizeUrl(result.bookmark.url)
        const existing = bookmarks.find(
          (b) => normalizeUrl(b.url) === normalized
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
            collectionId:
              result.bookmark.collectionId ?? (await getLastCollectionId()),
            hidden: false
          })
        }
      } else {
        setFlash(result.error)
        // Set empty form data so BookmarkForm renders instead of showing a spinner
        setInitialFormData({ url: '', title: '', note: '', picture: '', tags: [], collectionId: undefined, hidden: false })
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
        const previous = { ...bookmark } as BookmarkItem
        await updateBookmark(bookmark.id, {
          url: data.url,
          title: data.title,
          note: data.note,
          picture: data.picture,
          tags: data.tags,
          collectionId: data.collectionId,
          hidden: data.hidden
        })
        setOutcome({ kind: 'updated', previous })
      } else {
        const created = await addBookmark({
          url: data.url,
          title: data.title,
          note: data.note,
          picture: data.picture,
          tags: data.tags,
          collectionId: data.collectionId,
          hidden: data.hidden,
          pinned: false
        })
        // Pre-select this collection next time (also remembers "No collection")
        setStorageItem(STORAGE_KEYS.LAST_COLLECTION, data.collectionId ?? null).catch(
          () => {}
        )
        if (created) setOutcome({ kind: 'created', bookmark: created })
      }
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

  const handleRemove = async () => {
    if (!bookmark?.id) return
    const snapshot = { ...bookmark } as BookmarkItem
    setIsWorking(true)
    try {
      await deleteBookmark(snapshot.id)
      setOutcome({ kind: 'removed', bookmark: snapshot })
    } catch (error) {
      setFlash(
        'Failed to remove bookmark: ' +
          ((error as Error).message ?? 'Unknown error')
      )
    } finally {
      setIsWorking(false)
    }
  }

  // Undo the last action and go back to the form with the data it had
  const handleUndo = async () => {
    if (!outcome) return
    setIsWorking(true)
    try {
      if (outcome.kind === 'created') {
        await deleteBookmark(outcome.bookmark.id)
        setExistingBookmarkId(null)
        setInitialFormData(toFormData(outcome.bookmark))
      } else if (outcome.kind === 'updated') {
        const { id, created_at, updated_at, ...fields } = outcome.previous
        await updateBookmark(id, fields)
        setInitialFormData(toFormData(outcome.previous))
      } else {
        await restoreBookmark(outcome.bookmark)
        if (outcome.bookmark.id !== selectedBookmark) {
          setExistingBookmarkId(outcome.bookmark.id)
        }
        setInitialFormData(toFormData(outcome.bookmark))
      }
      setOutcome(null)
    } catch (error) {
      setFlash('Undo failed: ' + ((error as Error).message ?? 'Unknown error'))
    } finally {
      setIsWorking(false)
    }
  }

  const outcomeMessage =
    outcome?.kind === 'removed'
      ? 'Bookmark removed'
      : outcome?.kind === 'updated'
        ? 'Bookmark updated'
        : 'Bookmark saved'

  // "Saved 3 weeks ago in Reading" for pages that are already bookmarked
  const existingInfo = (() => {
    if (!existingBookmarkId || !bookmark?.id || !bookmark.created_at) return null
    const collection = collections.find((c) => c.id === bookmark.collectionId)
    return `Saved ${formatRelativeTime(bookmark.created_at)}${
      collection ? ` in ${collection.name}` : ''
    }`
  })()

  const handleOpenLibrary = () => {
    openExtensionPage('app')
    window.close()
  }

  return (
    <div className={styles.component}>
      <Header />

      {outcome ? (
        <div className={styles.successContainer}>
          <div
            className={`${styles.successIcon} ${
              outcome.kind === 'removed' ? styles.removedIcon : ''
            }`}
          >
            {outcome.kind === 'removed' ? (
              <Trash2 size={28} />
            ) : (
              <Check size={32} />
            )}
          </div>
          <span className={styles.successMessage}>{outcomeMessage}</span>
          <div className={styles.successActions}>
            <Button
              color='light'
              variant='ghost'
              onClick={handleUndo}
              disabled={isWorking}
            >
              {isWorking ? (
                <Loader2 size={14} className={styles.spinner} />
              ) : (
                <Undo2 size={14} />
              )}
              Undo
            </Button>
            {outcome.kind !== 'removed' && (
              <Button color='light' variant='ghost' onClick={handleOpenLibrary}>
                <ExternalLink size={14} />
                Open my bookmarks
              </Button>
            )}
            <Button autoFocus onClick={() => window.close()} disabled={isWorking}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.page}>
          {bookmark?.id && (
            <div className={styles.pageTitle}>
              <Text as='h1' size='1' weight='medium' className={styles.pageTitleText}>
                {existingBookmarkId ? 'Already bookmarked' : 'Edit bookmark'}
              </Text>
              {existingInfo && (
                <span className={styles.pageTitleInfo}>{existingInfo}</span>
              )}
            </div>
          )}

          <BookmarkForm
            initialData={initialFormData}
            onSubmit={handleSubmit}
            isSubmitting={isSaving}
            submitLabel={submitLabel}
            layout='popup'
            autoFocusNote={!bookmark?.id}
            onRefreshMetadata={
              bookmark?.id && initialFormData.url?.trim()
                ? handleRefreshMetadata
                : undefined
            }
            isRefreshing={isRefreshing || isLoading}
            secondaryAction={
              bookmark?.id ? (
                <Button
                  type='button'
                  variant='ghost'
                  color='light'
                  className={styles.removeButton}
                  onClick={handleRemove}
                  disabled={isWorking || isSaving}
                  title='Remove this bookmark'
                >
                  <Trash2 size={14} />
                  Remove
                </Button>
              ) : undefined
            }
          />
        </div>
      )}
    </div>
  )
}
