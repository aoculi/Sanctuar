import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useManifest } from '@/components/hooks/useManifest'
import usePopupSize from '@/components/hooks/usePopupSize'
import { STORAGE_KEYS } from '@/lib/constants'
import { captureCurrentPage } from '@/lib/pageCapture'
import { getDefaultSettings, getStorageItem, Settings } from '@/lib/storage'
import type { Bookmark as BookmarkType, Tag } from '@/lib/types'
import { generateId } from '@/lib/utils'
import { MAX_TAGS_PER_ITEM } from '@/lib/validation'

import Header from '@/components/parts/Header'
import Button from '@/components/ui/Button'
import ErrorCallout from '@/components/ui/ErrorCallout'
import Input from '@/components/ui/Input'
import { TagSelectorField } from '@/components/ui/TagSelectorField'

import styles from './styles.module.css'

const emptyBookmark = {
  url: '',
  title: '',
  picture: '',
  tags: [] as string[]
}

export default function Bookmark({ bookmark }: { bookmark?: BookmarkType }) {
  usePopupSize('compact')
  const { navigate } = useNavigation()
  const { manifest, save, isSaving } = useManifest()

  const [tags, setTags] = useState<Tag[]>([])
  const [settings, setSettings] = useState<Settings>(getDefaultSettings())
  const [form, setForm] = useState(emptyBookmark)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Load settings when the route is displayed
  useEffect(() => {
    const loadSettings = async () => {
      const storedSettings = await getStorageItem<Settings>(
        STORAGE_KEYS.SETTINGS
      )
      if (storedSettings) {
        setSettings(storedSettings)
      }
    }
    loadSettings()
  }, [])

  // Update tags when manifest loads
  useEffect(() => {
    if (manifest?.tags) {
      setTags(manifest.tags)
    }
  }, [manifest])

  // Initialize form when editing an existing bookmark
  useEffect(() => {
    if (bookmark) {
      setForm({
        url: bookmark.url,
        title: bookmark.title,
        picture: bookmark.picture,
        tags: bookmark.tags
      })
    }
  }, [bookmark])

  // Capture current page when creating a new bookmark
  useEffect(() => {
    // if we update a page, do not capture it again
    if (bookmark) {
      return
    }

    const loadCurrentPage = async () => {
      setIsLoading(true)
      setCaptureError(null)

      const result = await captureCurrentPage()
      if (result.ok) {
        setForm({
          url: result.bookmark.url,
          title: result.bookmark.title,
          picture: result.bookmark.picture,
          tags: result.bookmark.tags
        })
      } else {
        setCaptureError(result.error)
      }

      setIsLoading(false)
    }

    loadCurrentPage()
  }, [bookmark])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // URL validation
    if (!form.url.trim()) {
      newErrors.url = 'URL is required'
    } else {
      try {
        const parsed = new URL(form.url.trim())
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          newErrors.url = 'URL must start with http:// or https://'
        }
      } catch {
        newErrors.url = 'Please enter a valid URL'
      }
    }

    // Title validation
    if (!form.title.trim()) {
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

    if (!manifest) {
      setSaveError('Manifest not loaded. Please try again.')
      return
    }

    setIsLoading(true)
    setSaveError(null)

    try {
      const now = Date.now()

      if (bookmark) {
        // Update existing bookmark
        await save({
          ...manifest,
          items: manifest.items.map((item) =>
            item.id === bookmark.id
              ? {
                  ...item,
                  url: form.url.trim(),
                  title: form.title.trim(),
                  picture: form.picture.trim(),
                  tags: form.tags,
                  updated_at: now
                }
              : item
          )
        })
      } else {
        // Create new bookmark
        const newBookmark: BookmarkType = {
          id: generateId(),
          url: form.url.trim(),
          title: form.title.trim(),
          picture: form.picture.trim(),
          tags: form.tags,
          created_at: now,
          updated_at: now
        }
        await save({
          ...manifest,
          items: [...manifest.items, newBookmark]
        })
      }

      navigate('/vault')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save bookmark'
      setSaveError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Check if there are changes and URL is set
  const hasChanges = useMemo(() => {
    if (!form.url.trim()) {
      return false
    }

    if (!bookmark) {
      // For new bookmarks, there's a change if URL is set
      return true
    }

    // For existing bookmarks, check if any field changed
    const urlChanged = form.url.trim() !== bookmark.url
    const titleChanged = form.title.trim() !== bookmark.title
    const pictureChanged = form.picture.trim() !== bookmark.picture

    // Check if tags changed (compare arrays)
    const tagsChanged =
      form.tags.length !== bookmark.tags.length ||
      form.tags.some((tag) => !bookmark.tags.includes(tag)) ||
      bookmark.tags.some((tag) => !form.tags.includes(tag))

    return urlChanged || titleChanged || pictureChanged || tagsChanged
  }, [form, bookmark])

  const selectableTags = useMemo(() => {
    if (settings.showHiddenTags) {
      return tags
    }

    // Keep already-selected hidden tags visible while hiding them from suggestions
    const selectedHiddenTags = tags.filter(
      (tag) => tag.hidden && form.tags.includes(tag.id)
    )
    const visibleTags = tags.filter((tag) => !tag.hidden)

    return [...visibleTags, ...selectedHiddenTags]
  }, [tags, settings.showHiddenTags, form.tags])

  const buttonLabel = bookmark ? 'Save' : 'Create'

  return (
    <div className={styles.component}>
      <Header title={bookmark ? 'Edit' : 'New'} canSwitchToVault={true} />

      <div className={styles.page}>
        {captureError && <ErrorCallout>{captureError}</ErrorCallout>}
        {saveError && <ErrorCallout>{saveError}</ErrorCallout>}

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
