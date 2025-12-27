import { Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useManifest } from '@/components/hooks/providers/useManifestProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useSettings } from '@/components/hooks/providers/useSettingsProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import usePopupSize from '@/components/hooks/usePopupSize'
import { useTags } from '@/components/hooks/useTags'
import { captureCurrentPage, refreshBookmarkMetadata } from '@/lib/pageCapture'
import { MAX_TAGS_PER_ITEM } from '@/lib/validation'

import Header from '@/components/parts/Header'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { TagSelectorField } from '@/components/ui/TagSelectorField'
import Textarea from '@/components/ui/Textarea'

import styles from './styles.module.css'

const emptyBookmark = {
  id: '',
  created_at: 0,
  updated_at: 0,
  url: '',
  title: '',
  note: '',
  picture: '',
  tags: [] as string[]
}

export default function Bookmark() {
  usePopupSize('compact')
  const { navigate, selectedBookmark, setFlash } = useNavigation()
  const { isSaving } = useManifest()
  const { addBookmark, updateBookmark, bookmarks } = useBookmarks()
  const { tags } = useTags()
  const { settings } = useSettings()
  let bookmark = bookmarks.find((item) => item.id === selectedBookmark) || null
  if (selectedBookmark === 'blank') {
    bookmark = emptyBookmark
  }

  const [form, setForm] =
    useState<Omit<typeof emptyBookmark, 'id' | 'created_at' | 'updated_at'>>(
      emptyBookmark
    )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Initialize form when editing an existing bookmark
  useEffect(() => {
    if (bookmark) {
      setForm({
        url: bookmark.url,
        title: bookmark.title,
        note: bookmark.note,
        picture: bookmark.picture,
        tags: bookmark.tags
      })
    }
  }, [bookmark])

  // Check for duplicate URL when creating a new bookmark
  useEffect(() => {
    if (!bookmark && form.url?.trim()) {
      const trimmedUrl = form.url.trim()
      const duplicate = bookmarks.find(
        (b) => b.url.trim().toLowerCase() === trimmedUrl.toLowerCase()
      )
      if (duplicate) {
        setFlash('This page is already bookmarked')
      } else {
      }
    } else {
    }
  }, [form.url, bookmarks, bookmark])

  // Capture current page when creating a new bookmark
  useEffect(() => {
    // if we update a page, do not capture it again
    if (bookmark || selectedBookmark) {
      return
    }

    const loadCurrentPage = async () => {
      setIsLoading(true)
      setFlash(null)

      const result = await captureCurrentPage()
      if (result.ok) {
        setForm({
          url: result.bookmark.url,
          title: result.bookmark.title,
          note: result.bookmark.note,
          picture: result.bookmark.picture,
          tags: result.bookmark.tags
        })
      } else {
        setFlash(result.error)
      }

      setIsLoading(false)
    }

    loadCurrentPage()
  }, [bookmark, selectedBookmark])

  const handleRefreshMetadata = async () => {
    if (!form.url?.trim()) {
      setErrors((prev) => ({
        ...prev,
        url: 'URL is required to refresh metadata'
      }))
      return
    }

    setIsRefreshing(true)
    setFlash(null)

    try {
      const result = await refreshBookmarkMetadata(form.url.trim())
      if (result.ok) {
        setForm((prev) => ({
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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // URL validation
    if (!form.url?.trim()) {
      newErrors.url = 'URL is required'
    } else {
      try {
        const parsed = new URL(form.url?.trim())
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          newErrors.url = 'URL must start with http:// or https://'
        }
      } catch {
        newErrors.url = 'Please enter a valid URL'
      }
    }

    // Title validation
    if (!form.title?.trim()) {
      newErrors.title = 'Title is required'
    }

    // Tags validation
    if (form.tags.length > MAX_TAGS_PER_ITEM) {
      newErrors.tags = `Maximum ${MAX_TAGS_PER_ITEM} tags per bookmark`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm() || isLoading || isSaving) {
      return
    }

    setIsLoading(true)

    try {
      if (bookmark) {
        await updateBookmark(bookmark.id, {
          url: form.url?.trim(),
          title: form.title?.trim(),
          note: form.note?.trim(),
          picture: form.picture?.trim(),
          tags: form.tags
        })
      } else {
        await addBookmark({
          url: form.url?.trim(),
          title: form.title?.trim(),
          note: form.note?.trim(),
          picture: form.picture?.trim(),
          tags: form.tags
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

  // Check if there are changes and URL is set
  const hasChanges = useMemo(() => {
    if (!form.url?.trim()) {
      return false
    }

    if (!bookmark) {
      // For new bookmarks, there's a change if URL is set
      return true
    }

    // For existing bookmarks, check if any field changed
    const urlChanged = form.url?.trim() !== bookmark?.url
    const titleChanged = form.title?.trim() !== bookmark?.title
    const noteChanged = form.note?.trim() !== bookmark?.note
    const pictureChanged = form.picture?.trim() !== bookmark?.picture

    // Check if tags changed (compare arrays)
    const tagsChanged =
      form.tags.length !== bookmark.tags.length ||
      form.tags.some((tag) => !bookmark.tags.includes(tag)) ||
      bookmark.tags.some((tag) => !form.tags.includes(tag))

    return (
      urlChanged || titleChanged || noteChanged || pictureChanged || tagsChanged
    )
  }, [form, bookmark])

  const selectableTags = useMemo(() => {
    if (settings.showHiddenTags) {
      return tags
    }

    // Create a Set for O(1) lookup instead of O(n) array includes
    const selectedTagIds = new Set(form.tags)

    // Keep already-selected hidden tags visible while hiding them from suggestions
    const selectedHiddenTags: typeof tags = []
    const visibleTags: typeof tags = []

    // Single pass through tags array for better performance
    for (const tag of tags) {
      if (tag.hidden) {
        if (selectedTagIds.has(tag.id)) {
          selectedHiddenTags.push(tag)
        }
      } else {
        visibleTags.push(tag)
      }
    }

    return [...visibleTags, ...selectedHiddenTags]
  }, [tags, settings.showHiddenTags, form.tags])

  const buttonLabel = bookmark ? 'Save' : 'Create'

  return (
    <div className={styles.component}>
      <Header
        title={bookmark ? 'Edit' : 'New'}
        canSwitchToVault={true}
        rightContent={
          bookmark && bookmark.id ? (
            <Button
              onClick={handleRefreshMetadata}
              disabled={!form.url?.trim() || isRefreshing || isLoading}
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
        <div className={styles.content}>
          {form.picture && (
            <div className={styles.picture}>
              <img src={form.picture} alt={form.title} />
            </div>
          )}

          <Input
            type='hidden'
            value={form.picture}
            onChange={(e) => {
              const next = e.target.value
              setForm((prev) => ({ ...prev, picture: next }))
            }}
          />

          <Input
            error={errors.url}
            size='lg'
            type='url'
            placeholder='https://example.com'
            value={form.url}
            onChange={(e) => {
              const next = e.target.value
              setForm((prev) => ({ ...prev, url: next }))
              if (errors.url) setErrors({ ...errors, url: '' })
            }}
          />

          <Input
            error={errors.title}
            size='lg'
            type='text'
            value={form.title}
            onChange={(e) => {
              const next = e.target.value
              setForm((prev) => ({ ...prev, title: next }))
              if (errors.title) setErrors({ ...errors, title: '' })
            }}
            placeholder='Bookmark title'
          />

          <Textarea
            size='lg'
            value={form.note}
            onChange={(e) => {
              const next = e.target.value
              setForm((prev) => ({ ...prev, note: next }))
            }}
            placeholder='Add a note...'
            rows={4}
          />

          <TagSelectorField
            tags={selectableTags}
            selectedTags={form.tags}
            onChange={(tags) => setForm((prev) => ({ ...prev, tags }))}
          />

          {errors.tags && (
            <span className={styles.fieldError}>{errors.tags}</span>
          )}
        </div>

        <div className={styles.actions}>
          <Button
            onClick={() => {
              navigate('/vault')
            }}
            color='black'
          >
            Cancel
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={!hasChanges || isLoading || isSaving}
          >
            {(isLoading || isSaving) && <Loader2 className={styles.spinner} />}
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
