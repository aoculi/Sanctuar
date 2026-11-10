import {
  Check,
  ExternalLink,
  Loader2,
  Pencil,
  Trash2,
  Undo2
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useManifest } from '@/components/hooks/providers/useManifestProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useSettings } from '@/components/hooks/providers/useSettingsProvider'
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
  description: b.description ?? '',
  picture: b.picture,
  tags: b.tags,
  collectionId: b.collectionId,
  hidden: b.hidden ?? false
})

/** How long the result screen stays before closing itself ("After saving: close") */
const AUTO_CLOSE_MS = 1200

const emptyBookmark = {
  id: '',
  created_at: 0,
  updated_at: 0,
  url: '',
  title: '',
  note: '',
  description: '',
  picture: '',
  tags: [] as string[],
  collectionId: undefined as string | undefined
}

export default function Bookmark() {
  usePopupSize('compact')
  const { selectedBookmark, setFlash } = useNavigation()
  const { isSaving, isLoading: manifestLoading } = useManifest()
  const { settings, isLoading: settingsLoading } = useSettings()
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
  // Editing a bookmark that was just saved, via "Edit" on the result screen
  const [isEditingSaved, setIsEditingSaved] = useState(false)
  const [autoCloseCancelled, setAutoCloseCancelled] = useState(false)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
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
        setInitialFormData({ url: '', title: '', note: '', description: '', picture: '', tags: [], collectionId, hidden: false })
      )
      return
    }
    if (selectedBookmark && bookmark?.id) {
      setInitialFormData({
        url: bookmark.url,
        title: bookmark.title,
        note: bookmark.note,
        description: bookmark.description ?? '',
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
    if (
      hasLoadedRef.current ||
      selectedBookmark ||
      manifestLoading ||
      settingsLoading
    ) {
      return
    }
    // Mark as started right away: `bookmarks` changes on every render, and
    // this must never run twice (it may create a bookmark in quick-save mode)
    hasLoadedRef.current = true

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
            description: existing.description ?? '',
            picture: existing.picture,
            tags: existing.tags,
            collectionId: existing.collectionId,
            hidden: existing.hidden ?? false
          })
        } else {
          // New bookmark - use captured page data
          const captured: BookmarkFormData = {
            url: result.bookmark.url,
            title: result.bookmark.title,
            note: result.bookmark.note,
            description: result.bookmark.description ?? '',
            picture: result.bookmark.picture,
            tags: result.bookmark.tags,
            collectionId:
              result.bookmark.collectionId ?? (await getLastCollectionId()),
            hidden: false
          }
          // "Save immediately": create it now, then show the result screen
          // (Undo / Edit / Done). Falls back to the form if saving fails.
          if (settings.popupOpenAction === 'save') {
            await createBookmark(captured)
          }
          setInitialFormData(captured)
        }
      } else {
        setFlash(result.error)
        // Set empty form data so BookmarkForm renders instead of showing a spinner
        setInitialFormData({ url: '', title: '', note: '', description: '', picture: '', tags: [], collectionId: undefined, hidden: false })
      }

      hasLoadedRef.current = true
      setIsLoading(false)
    }

    loadCurrentPage()
  }, [selectedBookmark, setFlash, bookmarks, manifestLoading, settingsLoading])

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
          picture: result.favicon,
          // Keep the current description when the page has none
          ...(result.description ? { description: result.description } : {})
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

  /** Create a bookmark and show the result screen; returns false on failure */
  const createBookmark = async (data: BookmarkFormData): Promise<boolean> => {
    try {
      const created = await addBookmark({
        url: data.url,
        title: data.title,
        note: data.note,
        description: data.description || undefined,
        picture: data.picture,
        tags: data.tags,
        collectionId: data.collectionId,
        hidden: data.hidden,
        pinned: false
      })
      // Pre-select this collection next time (also remembers "No collection")
      setStorageItem(
        STORAGE_KEYS.LAST_COLLECTION,
        data.collectionId ?? null
      ).catch(() => {})
      if (created) setOutcome({ kind: 'created', bookmark: created })
      return !!created
    } catch (error) {
      setFlash(
        'Failed to save bookmark: ' +
          ((error as Error).message ?? 'Unknown error')
      )
      return false
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
          description: data.description || undefined,
          picture: data.picture,
          tags: data.tags,
          collectionId: data.collectionId,
          hidden: data.hidden
        })
        setOutcome({ kind: 'updated', previous })
      } else {
        await createBookmark(data)
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
        setIsEditingSaved(false)
        setInitialFormData(toFormData(outcome.bookmark))
      } else if (outcome.kind === 'updated') {
        const { id, created_at, updated_at, ...fields } = outcome.previous
        // Explicit description: an absent key would keep the edited value
        await updateBookmark(id, {
          ...fields,
          description: outcome.previous.description
        })
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

  // "Edit" on the result screen: reopen the form on the saved bookmark, so
  // submitting updates it instead of creating a second one
  const handleEditSaved = () => {
    if (!outcome || outcome.kind === 'removed') return
    const target =
      outcome.kind === 'created'
        ? (bookmarks.find((b) => b.id === outcome.bookmark.id) ??
          outcome.bookmark)
        : bookmark
    if (!target?.id) return
    if (target.id !== selectedBookmark) {
      setExistingBookmarkId(target.id)
      setIsEditingSaved(true)
    }
    setInitialFormData(toFormData(target as BookmarkItem))
    setOutcome(null)
  }

  // "After saving: close the popup automatically" — after AUTO_CLOSE_MS,
  // unless the user interacts with the result screen (hover, focus, click, key)
  const autoClose =
    !!outcome &&
    outcome.kind !== 'removed' &&
    settings.afterSave === 'close' &&
    !autoCloseCancelled

  useEffect(() => {
    setAutoCloseCancelled(false)
    pointerStartRef.current = null
  }, [outcome])

  useEffect(() => {
    if (!autoClose) return
    const timer = setTimeout(() => window.close(), AUTO_CLOSE_MS)
    return () => clearTimeout(timer)
  }, [autoClose])

  const cancelAutoClose = () => {
    if (autoClose) setAutoCloseCancelled(true)
  }

  // Layout changes can fire a mousemove under a still cursor, so only a real
  // movement counts as hovering
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!autoClose) return
    const start = pointerStartRef.current
    if (!start) {
      pointerStartRef.current = { x: e.clientX, y: e.clientY }
      return
    }
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) {
      cancelAutoClose()
    }
  }

  const outcomeCollection =
    outcome && outcome.kind !== 'removed'
      ? collections.find(
          (c) =>
            c.id ===
            (outcome.kind === 'created'
              ? outcome.bookmark.collectionId
              : bookmark?.collectionId)
        )
      : undefined

  const outcomeMessage =
    outcome?.kind === 'removed'
      ? 'Bookmark removed'
      : outcome?.kind === 'updated'
        ? 'Bookmark updated'
        : 'Bookmark saved'

  // "Saved 3 weeks ago in Reading" for pages that are already bookmarked
  const existingInfo = (() => {
    if (
      isEditingSaved ||
      !existingBookmarkId ||
      !bookmark?.id ||
      !bookmark.created_at
    )
      return null
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
        <div
          className={styles.successContainer}
          onPointerDown={cancelAutoClose}
          onPointerMove={handlePointerMove}
          onFocus={cancelAutoClose}
          onKeyDown={cancelAutoClose}
        >
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
          {outcomeCollection && (
            <span className={styles.successDetail}>
              in {outcomeCollection.name}
            </span>
          )}
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
              <Button
                color='light'
                variant='ghost'
                onClick={handleEditSaved}
                disabled={isWorking}
              >
                <Pencil size={14} />
                Edit
              </Button>
            )}
            {outcome.kind !== 'removed' && (
              <Button color='light' variant='ghost' onClick={handleOpenLibrary}>
                <ExternalLink size={14} />
                Open my bookmarks
              </Button>
            )}
            {/* No autofocus while auto-closing: focusing would cancel it */}
            <Button
              autoFocus={!autoClose}
              onClick={() => window.close()}
              disabled={isWorking}
            >
              Done
            </Button>
          </div>
          {autoClose && (
            <div className={styles.autoClose} role='status'>
              <div className={styles.autoCloseTrack}>
                <span
                  className={styles.autoCloseBar}
                  style={{ animationDuration: `${AUTO_CLOSE_MS}ms` }}
                />
              </div>
              <span className={styles.autoCloseText}>
                Closing… move the mouse or press a key to keep it open
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.page}>
          {bookmark?.id && (
            <div className={styles.pageTitle}>
              <Text as='h1' size='1' weight='medium' className={styles.pageTitleText}>
                {existingBookmarkId && !isEditingSaved
                  ? 'Already bookmarked'
                  : 'Edit bookmark'}
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
